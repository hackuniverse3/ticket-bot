const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class BrowserService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      logger.info('Initializing browser...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      this.page = await this.browser.newPage();
      
      // Set viewport size
      await this.page.setViewport({
        width: 1280,
        height: 800
      });
      
      // Enable request interception
      await this.page.setRequestInterception(true);
      
      // Block unnecessary resources to improve performance
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      logger.info('Browser initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Error initializing browser: ${error.message}`);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      logger.info('Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Browser closed');
    }
  }
  
  async restart() {
    logger.info('Restarting browser...');
    await this.close();
    return await this.initialize();
  }

  getBrowser() {
    return this.browser;
  }

  getPage() {
    return this.page;
  }
}

module.exports = new BrowserService(); 