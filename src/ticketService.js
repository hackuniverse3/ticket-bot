const axios = require('axios');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const logger = require('./utils/logger');

// Define configurations for the API
const API_CONFIG = {
  baseUrl: 'https://webook.com/api',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

// Attempts to extract event ID and other details from the URL
function parseEventUrl(url) {
  try {
    const matches = url.match(/\/events\/([^\/]+)-(\d+)/);
    if (matches && matches.length >= 3) {
      return {
        eventSlug: matches[1],
        eventId: matches[2]
      };
    }
    
    // Alternative parsing if the above fails
    const segments = url.split('/');
    const lastSegment = segments[segments.length - 1];
    
    if (lastSegment && lastSegment.includes('-')) {
      const parts = lastSegment.split('-');
      const possibleId = parts[parts.length - 1];
      if (!isNaN(possibleId)) {
        return {
          eventSlug: parts.slice(0, -1).join('-'),
          eventId: possibleId
        };
      }
    }
    
    throw new Error('Could not parse event ID from URL');
  } catch (error) {
    logger.error('Error parsing event URL:', error);
    throw error;
  }
}

// API-based ticket checking
async function checkTicketsViaApi(eventId) {
  try {
    const response = await axios.get(`${API_CONFIG.baseUrl}/events/${eventId}/availability`, {
      headers: API_CONFIG.headers
    });
    
    if (response.status === 200 && response.data) {
      return {
        available: response.data.available,
        ticketCategories: response.data.categories || []
      };
    }
    
    return { available: false };
  } catch (error) {
    logger.warn('API ticket check failed, will fall back to browser-based check:', error.message);
    return { available: false, error: error.message };
  }
}

// Browser-based ticket checking - more reliable but slower
async function checkTicketsViaBrowser(eventUrl) {
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    logger.info(`Navigating to ${eventUrl}`);
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for any available ticket buttons
    const hasTicketButtons = await page.$$eval('.ticket-category, .book-button', elements => elements.length > 0);
    
    if (hasTicketButtons) {
      logger.info('Tickets appear to be available (buttons found)');
      
      // Optionally extract ticket categories
      const ticketCategories = await page.$$eval('.ticket-category', elements => {
        return elements.map(el => {
          const nameEl = el.querySelector('.name');
          const priceEl = el.querySelector('.price');
          const availabilityEl = el.querySelector('.availability');
          
          return {
            name: nameEl ? nameEl.textContent.trim() : 'Unknown',
            price: priceEl ? priceEl.textContent.trim() : 'Unknown',
            available: availabilityEl ? !availabilityEl.textContent.includes('Sold Out') : true,
            element: el.outerHTML
          };
        });
      });
      
      return {
        available: true,
        ticketCategories
      };
    }
    
    // Check for sold out indicators
    const soldOutElements = await page.$$('.sold-out, .unavailable, .no-tickets');
    if (soldOutElements.length > 0) {
      logger.info('Event appears to be sold out');
      return { available: false, reason: 'sold-out' };
    }
    
    logger.info('No clear ticket availability indicators found');
    return { available: false, reason: 'unknown' };
  } catch (error) {
    logger.error('Error during browser-based ticket check:', error);
    return { available: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to purchase tickets via browser automation
async function purchaseTicketsViaBrowser(eventUrl, ticketCategory, quantity) {
  let browser = null;
  
  try {
    // Launch the browser - we use non-headless for important purchase operations
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    logger.info(`Navigating to ${eventUrl} to purchase tickets`);
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Login if necessary
    const isLoggedIn = await page.$eval('body', body => body.textContent.includes('Log out') || body.textContent.includes('My Account'));
    
    if (!isLoggedIn) {
      logger.info('Logging in to webook.com');
      
      // Find and click login button
      await page.click('.login-button, .sign-in, [data-testid="login-button"]');
      
      // Wait for login form
      await page.waitForSelector('#email, [data-testid="email-input"]', { timeout: 10000 });
      
      // Fill login form
      await page.fill('#email, [data-testid="email-input"]', process.env.WEBOOK_EMAIL);
      await page.fill('#password, [data-testid="password-input"]', process.env.WEBOOK_PASSWORD);
      
      // Submit login form
      await page.click('.login-submit, [data-testid="login-submit-button"]');
      
      // Wait for successful login
      await page.waitForSelector('.user-profile, .logged-in-indicator, [data-testid="user-profile"]', { timeout: 20000 })
        .catch(() => logger.warn('Login success indicator not found, proceeding anyway'));
      
      logger.info('Login successful');
      
      // Navigate back to event page if needed
      await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    
    // Select ticket category if specified
    if (ticketCategory && ticketCategory !== 'General') {
      logger.info(`Selecting ticket category: ${ticketCategory}`);
      await page.$$eval('.ticket-category', (elements, category) => {
        const matchingCategory = elements.find(el => 
          el.textContent.toLowerCase().includes(category.toLowerCase())
        );
        if (matchingCategory) {
          matchingCategory.querySelector('button, .select-button').click();
        }
      }, ticketCategory);
    } else {
      // Just click the first available ticket button
      logger.info('Selecting first available ticket category');
      await page.click('.book-button, .buy-ticket, [data-testid="buy-ticket-button"]');
    }
    
    // Wait for ticket quantity selector
    await page.waitForSelector('.quantity-selector, [data-testid="quantity-selector"]', { timeout: 10000 });
    
    // Set quantity
    logger.info(`Setting ticket quantity to ${quantity}`);
    await page.fill('.quantity-input, [data-testid="quantity-input"]', quantity.toString());
    
    // Click continue/next
    await page.click('.continue-button, .next-button, [data-testid="continue-button"]');
    
    // Wait for checkout page
    await page.waitForSelector('.checkout-form, [data-testid="checkout-form"]', { timeout: 20000 });
    
    // Fill in any additional required fields (if needed)
    // This would depend on the specific checkout flow of webook.com
    
    // Submit payment (final step)
    logger.info('Submitting payment');
    await page.click('.payment-submit-button, [data-testid="payment-submit-button"]');
    
    // Wait for confirmation
    await page.waitForSelector('.confirmation, .success-message, [data-testid="confirmation"]', { timeout: 30000 });
    
    logger.info('Purchase successful!');
    
    // Extract confirmation number or other details if needed
    const confirmationNumber = await page.$eval('.confirmation-number, [data-testid="confirmation-number"]', el => el.textContent.trim())
      .catch(() => 'Unknown');
    
    return {
      success: true,
      confirmationNumber,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error during ticket purchase:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      // Keep the browser open for a moment to see the result before closing
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

// Main function to check for tickets and purchase them if available
async function checkAndPurchaseTickets(eventUrl) {
  try {
    // Parse event URL to get the event ID
    const { eventId } = parseEventUrl(eventUrl);
    
    // Try API-based check first (faster)
    let apiResult = await checkTicketsViaApi(eventId);
    
    // If API check fails or shows no tickets, try browser-based check
    if (!apiResult.available || apiResult.error) {
      logger.info('Trying browser-based ticket check');
      const browserResult = await checkTicketsViaBrowser(eventUrl);
      
      // Use browser-based result if it shows tickets are available
      if (browserResult.available) {
        apiResult = browserResult;
      }
    }
    
    if (!apiResult.available) {
      return {
        ticketsAvailable: false,
        timestamp: new Date().toISOString()
      };
    }
    
    // Tickets are available, attempt to purchase
    logger.info('Tickets are available! Attempting purchase...');
    const ticketCategory = process.env.TICKET_CATEGORY || 'General';
    const quantity = parseInt(process.env.NUMBER_OF_TICKETS || '1', 10);
    
    const purchaseResult = await purchaseTicketsViaBrowser(eventUrl, ticketCategory, quantity);
    
    return {
      ticketsAvailable: true,
      ticketCategories: apiResult.ticketCategories,
      purchaseSuccessful: purchaseResult.success,
      purchaseDetails: purchaseResult,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error in checkAndPurchaseTickets:', error);
    return {
      ticketsAvailable: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  checkAndPurchaseTickets,
  parseEventUrl
}; 