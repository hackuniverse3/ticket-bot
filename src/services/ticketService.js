const browserService = require('./browser');
const config = require('../config/config');
const websiteConfig = require('../config/websiteConfig');
const logger = require('../utils/logger');

class TicketService {
  constructor() {
    this.targetMatch = null;
    this.isLoggedIn = false;
  }

  /**
   * Set the target match to purchase tickets for
   * @param {Object} matchInfo - Information about the match
   * @param {string} matchInfo.name - Name of the match (e.g., "Real Madrid vs Barcelona")
   * @param {string} matchInfo.date - Date of the match
   * @param {number} matchInfo.quantity - Number of tickets to purchase
   */
  setTargetMatch(matchInfo) {
    this.targetMatch = matchInfo;
    logger.info(`Target match set: ${matchInfo.name} on ${matchInfo.date}, quantity: ${matchInfo.quantity}`);
    return this;
  }

  /**
   * Login to the website
   * @returns {Promise<boolean>} - Whether login was successful
   */
  async login() {
    const page = browserService.getPage();
    if (!page) {
      logger.error('Browser not initialized');
      return false;
    }

    try {
      logger.info('Logging in to website...');
      
      await page.goto(config.website.url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Click on login button/link
      await page.waitForSelector(websiteConfig.selectors.login.button, { timeout: 30000 });
      await page.click(websiteConfig.selectors.login.button);
      
      // Fill login form
      await page.waitForSelector(websiteConfig.selectors.login.usernameField, { timeout: 30000 });
      await page.type(websiteConfig.selectors.login.usernameField, config.website.username);
      await page.type(websiteConfig.selectors.login.passwordField, config.website.password);
      
      // Submit form
      await page.click(websiteConfig.selectors.login.submitButton);
      
      // Wait for login to complete
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      
      // Check if login was successful (e.g., by looking for user profile element)
      const isSuccess = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null;
      }, websiteConfig.selectors.login.userProfileIndicator);
      
      if (isSuccess) {
        logger.info('Login successful');
        this.isLoggedIn = true;
        return true;
      } else {
        logger.error('Login failed - could not detect logged-in state');
        return false;
      }
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      return false;
    }
  }

  /**
   * Search for the target match
   * @returns {Promise<string|null>} - URL to the match page if found
   */
  async searchMatch() {
    if (!this.targetMatch) {
      logger.error('No target match set');
      return null;
    }

    const page = browserService.getPage();
    if (!page) {
      logger.error('Browser not initialized');
      return null;
    }

    try {
      logger.info(`Searching for match: ${this.targetMatch.name}`);
      
      // Navigate to search or matches page
      await page.goto(`${config.website.url}${websiteConfig.paths.matches}`, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Search for the match
      await page.waitForSelector(websiteConfig.selectors.search.input, { timeout: 30000 });
      await page.type(websiteConfig.selectors.search.input, this.targetMatch.name);
      await page.click(websiteConfig.selectors.search.button);
      
      // Wait for search results
      await page.waitForSelector(websiteConfig.selectors.search.results, { timeout: 30000 });
      
      // Find the match in the results and get its link
      const matchUrl = await page.evaluate((matchName, matchDate, matchItemSelector) => {
        const matchElements = Array.from(document.querySelectorAll(matchItemSelector));
        const matchElement = matchElements.find(element => {
          const elementText = element.textContent;
          return elementText.includes(matchName) && elementText.includes(matchDate);
        });
        
        return matchElement ? matchElement.querySelector('a').href : null;
      }, this.targetMatch.name, this.targetMatch.date, websiteConfig.selectors.search.matchItem);
      
      if (matchUrl) {
        logger.info(`Match found: ${matchUrl}`);
        return matchUrl;
      } else {
        logger.warn(`Match not found: ${this.targetMatch.name} on ${this.targetMatch.date}`);
        return null;
      }
    } catch (error) {
      logger.error(`Search error: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if tickets are available for the match
   * @param {string} matchUrl - URL to the match page
   * @returns {Promise<boolean>} - Whether tickets are available
   */
  async checkTicketAvailability(matchUrl) {
    const page = browserService.getPage();
    if (!page) {
      logger.error('Browser not initialized');
      return false;
    }

    try {
      logger.info(`Checking ticket availability for: ${matchUrl}`);
      
      await page.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Check if tickets are available
      const ticketsAvailable = await page.evaluate((selector, unavailablePatterns) => {
        const availabilityElement = document.querySelector(selector);
        if (!availabilityElement) return false;
        
        const text = availabilityElement.textContent;
        return !unavailablePatterns.some(pattern => text.includes(pattern));
      }, websiteConfig.selectors.tickets.availabilityIndicator, websiteConfig.unavailabilityPatterns);
      
      if (ticketsAvailable) {
        logger.info('Tickets are available!');
        return true;
      } else {
        logger.info('Tickets are not available');
        return false;
      }
    } catch (error) {
      logger.error(`Error checking availability: ${error.message}`);
      return false;
    }
  }

  /**
   * Purchase tickets for the match
   * @param {string} matchUrl - URL to the match page
   * @returns {Promise<boolean>} - Whether purchase was successful
   */
  async purchaseTickets(matchUrl) {
    const page = browserService.getPage();
    if (!page) {
      logger.error('Browser not initialized');
      return false;
    }

    try {
      logger.info(`Attempting to purchase tickets: ${matchUrl}`);
      
      // Navigate to match page if not already there
      if (page.url() !== matchUrl) {
        await page.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      }
      
      // Select quantity
      await page.waitForSelector(websiteConfig.selectors.tickets.quantityDropdown, { timeout: 30000 });
      await page.select(websiteConfig.selectors.tickets.quantityDropdown, String(this.targetMatch.quantity));
      
      // Click buy/purchase button
      await page.waitForSelector(websiteConfig.selectors.tickets.buyButton, { timeout: 30000 });
      await page.click(websiteConfig.selectors.tickets.buyButton);
      
      // Wait for checkout page to load
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      
      // Complete checkout process
      
      // Assuming we need to confirm the purchase
      await page.waitForSelector(websiteConfig.selectors.tickets.confirmPurchaseButton, { timeout: 30000 });
      await page.click(websiteConfig.selectors.tickets.confirmPurchaseButton);
      
      // Wait for confirmation page
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      
      // Check if purchase was successful
      const purchaseSuccess = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null;
      }, websiteConfig.selectors.tickets.purchaseConfirmation);
      
      if (purchaseSuccess) {
        logger.info('Tickets purchased successfully!');
        
        // Take a screenshot of the confirmation page
        await page.screenshot({ path: `purchase-confirmation-${Date.now()}.png` });
        
        return true;
      } else {
        logger.error('Failed to purchase tickets');
        return false;
      }
    } catch (error) {
      logger.error(`Purchase error: ${error.message}`);
      return false;
    }
  }

  /**
   * The main function to monitor and purchase tickets
   * @returns {Promise<boolean>} - Whether the whole process was successful
   */
  async monitorAndPurchase() {
    if (!this.targetMatch) {
      logger.error('No target match set');
      return false;
    }

    try {
      // Ensure we're logged in
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          logger.error('Failed to login');
          return false;
        }
      }
      
      // Search for the match
      const matchUrl = await this.searchMatch();
      if (!matchUrl) {
        logger.warn('Match not found, will try again later');
        return false;
      }
      
      // Check ticket availability
      const ticketsAvailable = await this.checkTicketAvailability(matchUrl);
      if (!ticketsAvailable) {
        logger.info('Tickets not available yet, will try again later');
        return false;
      }
      
      // Purchase tickets
      const purchaseSuccess = await this.purchaseTickets(matchUrl);
      if (purchaseSuccess) {
        logger.info('Success! Tickets purchased.');
        return true;
      } else {
        logger.error('Failed to purchase tickets');
        return false;
      }
    } catch (error) {
      logger.error(`Error in monitor and purchase process: ${error.message}`);
      await browserService.restart();
      return false;
    }
  }
}

module.exports = new TicketService();