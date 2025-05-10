const puppeteer = require('puppeteer');
const config = require('config');
const logger = require('../utils/logger');
const EventFinder = require('./eventFinder');

class TicketBot {
  /**
   * Create a new ticket bot for a specific match
   * @param {Object} matchConfig - Configuration for this match
   */
  constructor(matchConfig) {
    this.matchName = matchConfig.name;
    this.url = matchConfig.url;
    this.searchTerm = matchConfig.searchTerm || this.matchName;
    this.team = matchConfig.team;
    this.preferredSeats = matchConfig.preferredSeats;
    this.alternative = matchConfig.alternative;
    this.baseUrl = config.get('website.baseUrl');
    this.paymentInfo = config.get('paymentInfo');
    this.browserConfig = config.get('browser');
    this.loginInfo = config.get('loginInfo');
    this.eventFinder = new EventFinder();
    
    logger.info(`Initialized ticket bot for ${this.matchName}`);
  }

  /**
   * Update the bot's configuration
   * @param {Object} newConfig - New configuration object
   */
  updateConfig(newConfig) {
    if (newConfig.team) this.team = newConfig.team;
    if (newConfig.preferredSeats) this.preferredSeats = newConfig.preferredSeats;
    if (newConfig.alternative) this.alternative = newConfig.alternative;
    if (newConfig.searchTerm) this.searchTerm = newConfig.searchTerm;
    
    logger.info(`Updated configuration for ${this.matchName}`);
  }

  /**
   * Main function to check for and purchase tickets
   */
  async checkAndPurchaseTickets() {
    logger.info(`Starting ticket check for ${this.matchName}`);
    
    // Find the event URL if not explicitly provided
    if (!this.url || this.url.trim() === '') {
      await this.findEventUrl();
    }
    
    // If we still don't have a URL, we can't proceed
    if (!this.url || this.url.trim() === '') {
      logger.error(`Could not find URL for ${this.matchName}`);
      throw new Error(`Could not find URL for ${this.matchName}`);
    }
    
    const browser = await this.launchBrowser();
    
    try {
      const page = await browser.newPage();
      
      // Configure viewport
      await page.setViewport({ width: 1280, height: 800 });
      
      // Login to the website first
      await this.login(page);
      
      // Navigate to the ticket page
      await this.navigateToTicketPage(page);
      
      // Select team
      await this.selectTeam(page);
      
      // Check if tickets are available
      const ticketsAvailable = await this.checkTicketAvailability(page);
      
      if (!ticketsAvailable) {
        logger.info(`No tickets available for ${this.matchName}`);
        return false;
      }
      
      // Select seats
      const seatsSelected = await this.selectSeats(page);
      
      if (!seatsSelected) {
        logger.info(`Failed to select desired seats for ${this.matchName}`);
        return false;
      }
      
      // Complete purchase
      await this.completePurchase(page);
      
      logger.info(`Successfully purchased tickets for ${this.matchName}`);
      return true;
    } catch (error) {
      logger.error(`Error during ticket purchase for ${this.matchName}: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Login to the webook.com website
   * @param {Page} page - Puppeteer page object
   */
  async login(page) {
    logger.info('Attempting to log in to webook.com');
    
    try {
      // Navigate to the main page
      await page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: 'logs/before-login.png' });
      
      // Look for common login button selectors
      const loginButtonSelectors = [
        'a[href*="login"], a[href*="signin"]',
        'button:has-text("Login"), button:has-text("Sign in")',
        '[data-testid="login-button"]',
        '.login-button, .signin-button',
        // Look for header elements that might contain login
        'header a[href*="login"], header button:has-text("Login")'
      ];
      
      // Wait for any login button to appear
      logger.info('Looking for login button...');
      await page.waitForSelector(loginButtonSelectors.join(', '), { timeout: 10000 });
      
      // Click the first available login button
      for (const selector of loginButtonSelectors) {
        const loginButton = await page.$(selector);
        if (loginButton) {
          logger.info(`Found login button with selector: ${selector}`);
          await loginButton.click();
          break;
        }
      }
      
      // Wait for login form
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
        .catch(() => logger.info('No navigation after clicking login button'));
      
      // Take a screenshot of the login page
      await page.screenshot({ path: 'logs/login-page.png' });
      
      // Look for email/username input
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        'input[placeholder*="Email"]',
        'input[placeholder*="Username"]'
      ];
      
      // Wait for email input
      logger.info('Looking for email/username input...');
      await page.waitForSelector(emailSelectors.join(', '), { timeout: 10000 });
      
      // Find and fill email input
      for (const selector of emailSelectors) {
        const emailInput = await page.$(selector);
        if (emailInput) {
          logger.info(`Found email input with selector: ${selector}`);
          await emailInput.type(this.loginInfo.email);
          break;
        }
      }
      
      // Look for password input
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id="password"]',
        'input[placeholder*="Password"]'
      ];
      
      // Wait for password input
      logger.info('Looking for password input...');
      await page.waitForSelector(passwordSelectors.join(', '), { timeout: 5000 });
      
      // Find and fill password input
      for (const selector of passwordSelectors) {
        const passwordInput = await page.$(selector);
        if (passwordInput) {
          logger.info(`Found password input with selector: ${selector}`);
          await passwordInput.type(this.loginInfo.password);
          break;
        }
      }
      
      // Look for submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Log in")'
      ];
      
      // Take screenshot before clicking submit
      await page.screenshot({ path: 'logs/before-submit-login.png' });
      
      // Find and click submit button
      logger.info('Looking for submit button...');
      for (const selector of submitSelectors) {
        const submitButton = await page.$(selector);
        if (submitButton) {
          logger.info(`Found submit button with selector: ${selector}`);
          await submitButton.click();
          break;
        }
      }
      
      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
        .catch(() => logger.info('No clear navigation after login submission'));
      
      // Take a screenshot after login
      await page.screenshot({ path: 'logs/after-login.png' });
      
      // Verify login was successful by checking for login-only elements
      const loginVerificationSelectors = [
        // Look for profile or account elements
        '[data-testid="user-profile"]',
        '.user-profile, .account-info',
        'a[href*="account"], a[href*="profile"]',
        // Or check for common logged-in text
        'text/Welcome back',
        'text/My Account',
        // Or check for logout button
        'a:has-text("Logout"), button:has-text("Logout")'
      ];
      
      const isLoggedIn = await page.$(loginVerificationSelectors.join(', ')).then(Boolean);
      
      if (isLoggedIn) {
        logger.info('Login successful!');
        return true;
      } else {
        logger.warn('Login may have failed - could not verify login state');
        // Continue anyway as the site might still be usable
        return false;
      }
    } catch (error) {
      logger.error(`Error during login: ${error.message}`);
      await page.screenshot({ path: 'logs/login-error.png' });
      // Continue with the process even if login fails
      return false;
    }
  }

  /**
   * Find the event URL using the event finder
   */
  async findEventUrl() {
    logger.info(`Finding URL for ${this.matchName} using search term: ${this.searchTerm}`);
    
    try {
      // Use the event finder to search for events
      const events = await this.eventFinder.findEvents(this.searchTerm);
      
      if (events.length === 0) {
        logger.warn(`No events found matching search term: ${this.searchTerm}`);
        return;
      }
      
      // Find the best matching event
      // We could use more sophisticated matching here, but for now we'll take the first one
      const event = events[0];
      
      logger.info(`Found event: ${event.title} with URL: ${event.url}`);
      
      // Update the URL
      this.url = event.url.replace(this.baseUrl, '');
      
      // If URL starts with "http", it's a full URL, so we'll extract the path
      if (this.url.startsWith('http')) {
        try {
          const urlObj = new URL(event.url);
          this.url = urlObj.pathname + urlObj.search;
        } catch (error) {
          logger.error(`Error parsing URL: ${error.message}`);
        }
      }
      
      logger.info(`Updated URL for ${this.matchName} to: ${this.url}`);
    } catch (error) {
      logger.error(`Error finding event URL: ${error.message}`);
    }
  }

  /**
   * Launch the browser instance
   */
  async launchBrowser() {
    const headless = process.env.HEADLESS || this.browserConfig.headless;
    const slowMo = parseInt(process.env.SLOW_MO || this.browserConfig.slowMo);
    
    return puppeteer.launch({
      headless: headless === "true" || headless === true ? 'new' : false,
      slowMo,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-software-rasterizer',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  /**
   * Navigate to the ticket page for this match
   */
  async navigateToTicketPage(page) {
    const fullUrl = `${this.baseUrl}${this.url}`;
    logger.info(`Navigating to ${fullUrl}`);
    
    await page.goto(fullUrl, { waitUntil: 'networkidle2' });
    
    // Take a screenshot of the page
    await page.screenshot({ path: 'logs/ticket-page.png' });
    
    // Check if we're redirected to a login page
    const isLoginPage = await page.evaluate(() => {
      // Look for login form elements
      return Boolean(
        document.querySelector('input[type="email"]') ||
        document.querySelector('input[type="password"]') ||
        document.querySelector('form[action*="login"]') ||
        document.querySelector('form[action*="signin"]')
      );
    });
    
    if (isLoginPage) {
      logger.warn('Redirected to login page. Attempting to login...');
      await this.login(page);
      
      // Navigate back to the ticket page after login
      logger.info(`Navigating back to ${fullUrl} after login`);
      await page.goto(fullUrl, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: 'logs/ticket-page-after-login.png' });
    }
    
    // Check for login walls or popups that might appear
    try {
      // Look for login popups or overlays
      const loginPopupSelectors = [
        // Common login popup selectors
        '.login-popup, .modal-login',
        'div[role="dialog"] input[type="email"]',
        '.overlay input[type="password"]'
      ];
      
      const hasLoginPopup = await page.$(loginPopupSelectors.join(', ')).then(Boolean);
      
      if (hasLoginPopup) {
        logger.info('Detected login popup or overlay. Attempting to log in...');
        
        // Try to find email/username and password inputs in the popup
        const emailSelectors = [
          'input[type="email"]',
          'input[name="email"]',
          'input[id="email"]',
          'input[placeholder*="Email"]'
        ];
        
        const passwordSelectors = [
          'input[type="password"]',
          'input[name="password"]',
          'input[id="password"]',
          'input[placeholder*="Password"]'
        ];
        
        // Try to fill in the popup login form
        const emailInput = await page.$(emailSelectors.join(', '));
        if (emailInput) {
          await emailInput.type(this.loginInfo.email);
          logger.info('Entered email in popup login form');
        }
        
        const passwordInput = await page.$(passwordSelectors.join(', '));
        if (passwordInput) {
          await passwordInput.type(this.loginInfo.password);
          logger.info('Entered password in popup login form');
        }
        
        // Try to find and click the submit button
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Sign in")',
          'button:has-text("Login")'
        ];
        
        const submitButton = await page.$(submitSelectors.join(', '));
        if (submitButton) {
          await submitButton.click();
          logger.info('Clicked submit button on login popup');
          
          // Wait for navigation or popup to close
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            .catch(() => logger.info('No navigation after popup login submission'));
        }
      }
    } catch (error) {
      logger.warn(`Error handling login popup: ${error.message}`);
      // Continue anyway
    }
    
    // Click on public tickets
    try {
      await page.waitForSelector('a:contains("Public Tickets")', { timeout: 10000 });
      await page.click('a:contains("Public Tickets")');
      logger.info('Clicked on Public Tickets');
    } catch (error) {
      logger.error(`Error clicking on Public Tickets: ${error.message}`);
      
      // Try alternative selectors
      try {
        const publicTicketSelectors = [
          'a:has-text("Tickets")',
          'button:has-text("Tickets")',
          'a:has-text("Buy Tickets")',
          'button:has-text("Buy Tickets")',
          'a[href*="tickets"]'
        ];
        
        for (const selector of publicTicketSelectors) {
          const ticketLink = await page.$(selector);
          if (ticketLink) {
            logger.info(`Found alternative tickets link with selector: ${selector}`);
            await ticketLink.click();
            logger.info('Clicked on alternative tickets link');
            
            // Wait for navigation
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
              .catch(() => logger.info('No navigation after clicking tickets link'));
            
            break;
          }
        }
      } catch (altError) {
        logger.error(`Also could not find alternative ticket links: ${altError.message}`);
        throw new Error('Could not find any ticket purchase options');
      }
    }
  }

  /**
   * Select the team
   */
  async selectTeam(page) {
    try {
      // Wait for team selection element
      await page.waitForSelector(`a:contains("${this.team}")`, { timeout: 10000 });
      await page.click(`a:contains("${this.team}")`);
      logger.info(`Selected team: ${this.team}`);
      
      // Click Next button
      await page.waitForSelector('button:contains("Next")', { timeout: 5000 });
      await page.click('button:contains("Next")');
      logger.info('Clicked Next after team selection');
    } catch (error) {
      logger.error(`Error selecting team: ${error.message}`);
      throw new Error(`Could not select team ${this.team}`);
    }
  }

  /**
   * Check if tickets are available
   */
  async checkTicketAvailability(page) {
    try {
      // Wait for stadium view to load
      await page.waitForSelector('.stadium-view, .block-view', { timeout: 15000 });
      
      // Check if there's an "Out of tickets" message
      const noTicketsElement = await page.$('.no-tickets-message, .sold-out-message');
      if (noTicketsElement) {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error checking ticket availability: ${error.message}`);
      return false;
    }
  }

  /**
   * Select seats based on configuration
   */
  async selectSeats(page) {
    try {
      // Determine the type of seating view (block or individual seats)
      const isBlockView = await page.$('.block-view');
      
      if (isBlockView) {
        return await this.selectBlockSeats(page);
      } else {
        return await this.selectIndividualSeats(page);
      }
    } catch (error) {
      logger.error(`Error selecting seats: ${error.message}`);
      return false;
    }
  }

  /**
   * Select block-type seats
   */
  async selectBlockSeats(page) {
    try {
      // Try to find the preferred section
      const preferredSectionSelector = `[data-section="${this.preferredSeats.section}"]`;
      const alternativeSectionSelector = `[data-section="${this.alternative.section}"]`;
      
      let sectionSelector;
      
      // Check if preferred section exists and is available
      const preferredSectionElement = await page.$(preferredSectionSelector);
      if (preferredSectionElement) {
        const isDisabled = await page.evaluate(
          el => el.classList.contains('disabled') || el.classList.contains('sold-out'),
          preferredSectionElement
        );
        
        if (!isDisabled) {
          sectionSelector = preferredSectionSelector;
          logger.info(`Found preferred section ${this.preferredSeats.section}`);
        }
      }
      
      // If preferred section is not available, try alternative
      if (!sectionSelector) {
        const alternativeSectionElement = await page.$(alternativeSectionSelector);
        if (alternativeSectionElement) {
          const isDisabled = await page.evaluate(
            el => el.classList.contains('disabled') || el.classList.contains('sold-out'),
            alternativeSectionElement
          );
          
          if (!isDisabled) {
            sectionSelector = alternativeSectionSelector;
            logger.info(`Using alternative section ${this.alternative.section}`);
          }
        }
      }
      
      // If neither section is available, return false
      if (!sectionSelector) {
        logger.info('Neither preferred nor alternative sections are available');
        return false;
      }
      
      // Click on the section
      await page.click(sectionSelector);
      
      // Select quantity
      const quantity = this.preferredSeats.section === sectionSelector 
        ? this.preferredSeats.quantity 
        : this.alternative.quantity;
      
      await page.waitForSelector('.quantity-selector', { timeout: 5000 });
      await page.select('.quantity-selector', quantity.toString());
      
      logger.info(`Selected ${quantity} tickets in section ${sectionSelector}`);
      
      // Click Next button
      await page.waitForSelector('button:contains("Next")', { timeout: 5000 });
      await page.click('button:contains("Next")');
      
      return true;
    } catch (error) {
      logger.error(`Error selecting block seats: ${error.message}`);
      return false;
    }
  }

  /**
   * Select individual seats
   */
  async selectIndividualSeats(page) {
    try {
      // First, try to find and click on the preferred section
      try {
        await page.waitForSelector(`[data-section="${this.preferredSeats.section}"]`, { timeout: 5000 });
        await page.click(`[data-section="${this.preferredSeats.section}"]`);
        logger.info(`Clicked on section ${this.preferredSeats.section}`);
      } catch (error) {
        // If preferred section is not found, try alternative
        try {
          await page.waitForSelector(`[data-section="${this.alternative.section}"]`, { timeout: 5000 });
          await page.click(`[data-section="${this.alternative.section}"]`);
          logger.info(`Clicked on alternative section ${this.alternative.section}`);
        } catch (alternativeError) {
          logger.error('Neither preferred nor alternative sections found');
          return false;
        }
      }
      
      // Wait for seats to load
      await page.waitForSelector('.seat:not(.sold-out)', { timeout: 10000 });
      
      // Determine if we need adjacent seats
      const adjacentSeats = this.preferredSeats.adjacentSeats;
      const quantity = this.preferredSeats.quantity;
      
      if (adjacentSeats) {
        // Find adjacent seats
        const adjacentSeatsFound = await this.findAndSelectAdjacentSeats(page, quantity);
        if (!adjacentSeatsFound) {
          logger.info(`Could not find ${quantity} adjacent seats`);
          return false;
        }
      } else {
        // Select any available seats up to the desired quantity
        const seatsSelected = await this.selectAnyAvailableSeats(page, quantity);
        if (seatsSelected < quantity) {
          logger.info(`Could only select ${seatsSelected} seats out of ${quantity}`);
          return false;
        }
      }
      
      // Click Next button
      await page.waitForSelector('button:contains("Next")', { timeout: 5000 });
      await page.click('button:contains("Next")');
      
      return true;
    } catch (error) {
      logger.error(`Error selecting individual seats: ${error.message}`);
      return false;
    }
  }

  /**
   * Find and select adjacent seats
   */
  async findAndSelectAdjacentSeats(page, quantity) {
    // Get all available seats
    const availableSeats = await page.$$('.seat:not(.sold-out)');
    
    // Get seat information (row, number)
    const seatInfo = await Promise.all(
      availableSeats.map(async (seat) => {
        const row = await page.evaluate(s => s.getAttribute('data-row'), seat);
        const number = await page.evaluate(s => parseInt(s.getAttribute('data-number')), seat);
        return { seat, row, number };
      })
    );
    
    // Group seats by row
    const seatsByRow = {};
    seatInfo.forEach(info => {
      if (!seatsByRow[info.row]) {
        seatsByRow[info.row] = [];
      }
      seatsByRow[info.row].push(info);
    });
    
    // Find adjacent seats
    for (const row in seatsByRow) {
      // Sort seats by number
      const seats = seatsByRow[row].sort((a, b) => a.number - b.number);
      
      // Find continuous sequence of seats
      for (let i = 0; i <= seats.length - quantity; i++) {
        if (seats[i + quantity - 1].number - seats[i].number === quantity - 1) {
          // Found adjacent seats, select them
          for (let j = i; j < i + quantity; j++) {
            await seats[j].seat.click();
            logger.info(`Selected seat ${row}${seats[j].number}`);
          }
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Select any available seats up to the desired quantity
   */
  async selectAnyAvailableSeats(page, quantity) {
    const availableSeats = await page.$$('.seat:not(.sold-out)');
    
    const seatsToSelect = Math.min(quantity, availableSeats.length);
    
    for (let i = 0; i < seatsToSelect; i++) {
      await availableSeats[i].click();
    }
    
    logger.info(`Selected ${seatsToSelect} seats`);
    return seatsToSelect;
  }

  /**
   * Complete the purchase process
   */
  async completePurchase(page) {
    try {
      // Wait for payment form
      await page.waitForSelector('form.payment-form', { timeout: 15000 });
      
      // Fill in payment details
      await page.type('input[name="cardNumber"]', this.paymentInfo.cardNumber);
      await page.type('input[name="expiryDate"]', this.paymentInfo.expiryDate);
      await page.type('input[name="cvv"]', this.paymentInfo.cvv);
      await page.type('input[name="firstName"]', this.paymentInfo.firstName);
      await page.type('input[name="lastName"]', this.paymentInfo.lastName);
      await page.type('input[name="email"]', this.paymentInfo.email);
      
      // Submit payment
      await page.click('button[type="submit"]');
      
      // Wait for confirmation
      await page.waitForSelector('.confirmation-message', { timeout: 30000 });
      
      const confirmationText = await page.$eval('.confirmation-message', el => el.textContent);
      logger.info(`Confirmation received: ${confirmationText}`);
      
      return true;
    } catch (error) {
      logger.error(`Error completing purchase: ${error.message}`);
      throw new Error('Failed to complete purchase');
    }
  }
}

module.exports = TicketBot; 