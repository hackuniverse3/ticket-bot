const puppeteer = require('puppeteer');
const config = require('config');
const logger = require('../utils/logger');

/**
 * Class responsible for finding events on the ticket website
 */
class EventFinder {
  /**
   * Create a new event finder
   */
  constructor() {
    this.baseUrl = config.get('website.baseUrl');
    this.browserConfig = config.get('browser');
  }

  /**
   * Find event URLs based on search terms
   * @param {string} searchTerm - The term to search for
   * @returns {Promise<Array>} Array of found events with their URLs and details
   */
  async findEvents(searchTerm) {
    logger.info(`Searching for events matching: ${searchTerm}`);
    
    const browser = await this.launchBrowser();
    
    try {
      const page = await browser.newPage();
      
      // Configure viewport for a better viewing experience
      await page.setViewport({ width: 1280, height: 900 });
      
      // Navigate to the main page
      const searchUrl = `${this.baseUrl}`;
      logger.info(`Navigating to ${searchUrl}`);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'logs/main-page.png' });
      logger.info('Saved screenshot of main page');
      
      // Try to find and click the search button based on the provided HTML
      try {
        // First try to find the button with the specific attributes from the HTML code
        const searchButtonSelector = [
          'button[data-testid="mobile-search"]',
          'button[data-location="header"]',
          'button[data-title="search"]',
          // Using the text content as a fallback
          'button:has-text("Search on webook.com")',
          // Using the image as another identifier
          'button:has(img[alt=""]:has([src*="search.svg"]))',
          // Generic search button selectors
          '.search-button',
          'button:has(p:has-text("Search"))'
        ];
        
        logger.info('Looking for search button with selectors: ' + searchButtonSelector.join(', '));
        
        // Wait for any of these selectors
        await page.waitForSelector(searchButtonSelector.join(', '), { timeout: 10000 });
        
        // Click the search button
        await page.click(searchButtonSelector[0]);
        logger.info('Clicked on search button');
        
        // After clicking, wait for the search input to appear
        await page.waitForSelector('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', 
          { timeout: 5000 });
        
        // Now look for the main search input seen in the screenshot
        const mainSearchInputSelector = 'input[placeholder*="Search events"], input[placeholder*="experiences"]';
        await page.waitForSelector(mainSearchInputSelector, { timeout: 5000 })
          .catch(() => logger.info('Main search input not found, using the available search input'));
        
        // Find the search input and type the search term
        const searchInputs = await page.$$('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
        
        if (searchInputs.length > 0) {
          await searchInputs[0].type(searchTerm);
          logger.info(`Entered search term: ${searchTerm}`);
          
          // Look for the search button after typing
          const searchSubmitSelector = [
            'button:has-text("Search")',
            'button.search-button',
            'button[type="submit"]',
            // From the screenshot
            'button.SearchBox_submit__38csD'
          ];
          
          // Wait briefly for any UI updates
          await page.waitForTimeout(1000);
          
          // Take a screenshot after typing
          await page.screenshot({ path: 'logs/after-typing-search.png' });
          
          // Try to find the search button
          const searchSubmitButton = await page.$(searchSubmitSelector.join(', '));
          
          if (searchSubmitButton) {
            logger.info('Found search submit button, clicking it');
            await searchSubmitButton.click();
          } else {
            logger.info('No search submit button found, pressing Enter');
            await searchInputs[0].press('Enter');
          }
          
          // Wait for search results to load
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            .catch(() => logger.info('No navigation occurred after search submission'));
          
          // Take a screenshot of search results
          await page.screenshot({ path: 'logs/search-results.png' });
          logger.info('Saved screenshot of search results');
        } else {
          logger.warn('Could not find search input after clicking search button');
        }
      } catch (error) {
        logger.warn(`Error with initial search approach: ${error.message}`);
        logger.info('Trying alternative search approach');
        
        // Alternative approach: Look for the search input directly in the header
        try {
          // Search input visible in the screenshot
          const directSearchInputSelector = 'input[placeholder*="Search events, experiences"], .SearchBox_searchInput__mSQRH';
          
          await page.waitForSelector(directSearchInputSelector, { timeout: 5000 });
          await page.type(directSearchInputSelector, searchTerm);
          logger.info(`Entered search term directly: ${searchTerm}`);
          
          // Find and click the search button
          const directSearchButtonSelector = 'button:has-text("Search"), .SearchBox_submit__38csD';
          await page.click(directSearchButtonSelector);
          
          // Wait for results
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            .catch(() => logger.info('No navigation occurred after direct search'));
          
          await page.screenshot({ path: 'logs/direct-search-results.png' });
        } catch (directSearchError) {
          logger.warn(`Direct search approach also failed: ${directSearchError.message}`);
          logger.info('Taking screenshot to diagnose the issue');
          await page.screenshot({ path: 'logs/search-error.png' });
        }
      }
      
      // Extract events from the page
      const events = await this.extractEvents(page);
      
      logger.info(`Found ${events.length} events`);
      return events;
    } catch (error) {
      logger.error(`Error finding events: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
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
   * Extract events from the page
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<Array>} Array of event objects
   */
  async extractEvents(page) {
    try {
      // Take page content for debugging
      const pageContent = await page.content();
      require('fs').writeFileSync('logs/page-content.html', pageContent);
      logger.info('Saved page content for analysis');
      
      // Look for common event display patterns based on the screenshot
      const events = await page.evaluate(() => {
        // Try multiple selectors that might represent event cards based on the screenshot
        const eventSelectors = [
          // Event cards from the screenshot
          '.event-card, .event-item',
          // Main content areas that might contain events
          '[data-testid="event-card"]',
          // Links that might be events
          'a[href*="/en/events/"]',
          // Generic cards that might be events
          '.card, .item'
        ];
        
        let allEventElements = [];
        
        // Try each selector group
        for (const selectorGroup of eventSelectors) {
          const elements = document.querySelectorAll(selectorGroup);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selectorGroup}`);
            allEventElements = [...allEventElements, ...Array.from(elements)];
          }
        }
        
        // Remove duplicates
        const uniqueElements = [...new Set(allEventElements)];
        
        return uniqueElements.map(el => {
          // Determine if element is a link or contains links
          const linkElement = el.tagName === 'A' ? el : el.querySelector('a');
          const link = linkElement ? linkElement.href : '';
          
          // Try to extract title - look for heading elements first
          const possibleTitleElements = [
            el.querySelector('h1, h2, h3, h4, h5, h6'),
            el.querySelector('.title, .event-title'),
            linkElement,
            el
          ].filter(Boolean);
          
          let title = 'Unknown Event';
          for (const titleEl of possibleTitleElements) {
            const text = titleEl.textContent.trim();
            if (text && text.length > 0 && text.length < 100) {
              title = text;
              break;
            }
          }
          
          // Try to extract date
          const dateElement = el.querySelector('.date, time, [data-testid="date"]');
          const date = dateElement ? dateElement.textContent.trim() : '';
          
          // Try to extract price
          const priceElement = el.querySelector('.price, [data-testid="price"]');
          const price = priceElement ? priceElement.textContent.trim() : '';
          
          // Try to extract location
          const locationElement = el.querySelector('.location, [data-testid="location"]');
          const location = locationElement ? locationElement.textContent.trim() : '';
          
          // Extract image if available
          const imageElement = el.querySelector('img');
          const imageUrl = imageElement ? imageElement.src : '';
          
          // Extract teams if available
          const teamsElement = el.querySelector('.teams, .participants');
          const teams = teamsElement ? 
            Array.from(teamsElement.querySelectorAll('.team, .participant')).map(t => t.textContent.trim()) : 
            [];
          
          // If no teams found, try to extract from title
          if (teams.length === 0) {
            const vsMatch = title.match(/(.*?)\s+(?:vs|VS|v\.)\s+(.*)/i);
            if (vsMatch) {
              teams.push(vsMatch[1].trim(), vsMatch[2].trim());
            }
          }
          
          return {
            title,
            url: link,
            date,
            price,
            teams,
            location,
            imageUrl,
            element: {
              text: el.textContent.trim().substring(0, 150) + '...',
              html: el.outerHTML.substring(0, 500) + '...'
            }
          };
        });
      });
      
      // Log detailed information about what was found
      const filteredEvents = events.filter(event => event.url);
      
      if (filteredEvents.length === 0) {
        logger.warn('No events with URLs found. Raw elements detected:');
        events.forEach((event, i) => {
          logger.warn(`Element ${i}: ${event.element.text}`);
        });
      } else {
        logger.info('Found events:');
        filteredEvents.forEach((event, i) => {
          logger.info(`Event ${i}: ${event.title} - ${event.url}`);
        });
      }
      
      return filteredEvents;
    } catch (error) {
      logger.error(`Error extracting events: ${error.message}`);
      return [];
    }
  }
}

module.exports = EventFinder; 