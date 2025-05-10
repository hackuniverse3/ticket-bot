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
      
      // Construct the search URL directly
      const searchUrl = `${this.baseUrl}/en/search?q=${encodeURIComponent(searchTerm)}`;
      logger.info(`Navigating directly to search URL: ${searchUrl}`);
      
      // Navigate directly to the search results page
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'logs/search-results.png' });
      logger.info('Saved screenshot of search results');
      
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