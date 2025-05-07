const axios = require('axios');
const cheerio = require('cheerio');
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
    logger.warn('API ticket check failed, will fall back to HTTP check:', error.message);
    return { available: false, error: error.message };
  }
}

// HTTP-based ticket checking - scraping the page directly
async function checkTicketsViaHttp(eventUrl) {
  try {
    logger.info(`Making HTTP request to ${eventUrl}`);
    const response = await axios.get(eventUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      // Check for any available ticket buttons or elements
      const ticketButtons = $('.ticket-category, .book-button, [data-testid="buy-ticket-button"]');
      
      if (ticketButtons.length > 0) {
        logger.info('Tickets appear to be available (HTML indicators found)');
        
        // Extract ticket categories if possible
        const ticketCategories = [];
        $('.ticket-category').each((i, el) => {
          const nameEl = $(el).find('.name');
          const priceEl = $(el).find('.price');
          const availabilityEl = $(el).find('.availability');
          
          ticketCategories.push({
            name: nameEl.length ? nameEl.text().trim() : 'Unknown',
            price: priceEl.length ? priceEl.text().trim() : 'Unknown',
            available: availabilityEl.length ? !availabilityEl.text().includes('Sold Out') : true
          });
        });
        
        return {
          available: true,
          ticketCategories
        };
      }
      
      // Check for sold out indicators
      const soldOutElements = $('.sold-out, .unavailable, .no-tickets');
      if (soldOutElements.length > 0) {
        logger.info('Event appears to be sold out');
        return { available: false, reason: 'sold-out' };
      }
      
      logger.info('No clear ticket availability indicators found in HTML');
      return { available: false, reason: 'unknown' };
    }
    
    return { available: false, reason: 'failed-request', status: response.status };
  } catch (error) {
    logger.error('Error during HTTP-based ticket check:', error);
    return { available: false, error: error.message };
  }
}

// Function to purchase tickets via HTTP POST requests
async function purchaseTicketsViaHttp(eventUrl, ticketCategory, quantity) {
  try {
    logger.info(`Attempting to purchase tickets via HTTP for ${eventUrl}`);
    logger.info(`Ticket category: ${ticketCategory}, Quantity: ${quantity}`);
    
    // 1. First, get the page to extract form info and tokens
    const pageResponse = await axios.get(eventUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (pageResponse.status !== 200) {
      throw new Error(`Failed to load event page, status: ${pageResponse.status}`);
    }
    
    const $ = cheerio.load(pageResponse.data);
    
    // 2. Extract necessary form data and tokens
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
    const eventId = $('input[name="event_id"]').val() || parseEventUrl(eventUrl).eventId;
    
    // Find the right ticket category ID based on name
    let ticketId = '';
    if (ticketCategory && ticketCategory !== 'General') {
      $('.ticket-category').each((i, el) => {
        const name = $(el).find('.name').text().trim();
        if (name.toLowerCase().includes(ticketCategory.toLowerCase())) {
          ticketId = $(el).data('id') || $(el).attr('id') || '';
        }
      });
    } else {
      // Just get the first available ticket
      ticketId = $('.ticket-category').first().data('id') || $('.ticket-category').first().attr('id') || '';
    }
    
    if (!ticketId) {
      logger.warn('Could not identify ticket ID, will try to proceed with the first available option');
      // Check for any "Buy" or "Book" buttons
      const buyButton = $('.buy-button, .book-button, [data-testid="buy-ticket-button"]').first();
      if (buyButton.length) {
        const formAction = buyButton.closest('form').attr('action') || '';
        if (formAction) {
          const formActionParts = formAction.split('/');
          ticketId = formActionParts[formActionParts.length - 1];
        } else {
          ticketId = eventId; // Fallback to event ID if we can't find the ticket ID
        }
      } else {
        throw new Error('No buy buttons found on the page');
      }
    }
    
    // 3. Login if there's a login form
    let cookies = '';
    const loginForm = $('.login-form, [data-testid="login-form"]');
    if (loginForm.length) {
      logger.info('Login form found, attempting to log in');
      
      const loginUrl = loginForm.attr('action') || 'https://webook.com/en/login';
      
      const loginResponse = await axios.post(loginUrl, {
        email: process.env.WEBOOK_EMAIL,
        password: process.env.WEBOOK_PASSWORD,
        _token: csrfToken
      }, {
        headers: {
          ...API_CONFIG.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': eventUrl
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      });
      
      if (loginResponse.headers['set-cookie']) {
        cookies = loginResponse.headers['set-cookie'];
        logger.info('Login successful, cookies obtained');
      }
    }
    
    // 4. Submit initial ticket selection
    const selectTicketUrl = `${eventUrl}/book`;
    logger.info(`Selecting tickets at: ${selectTicketUrl}`);
    
    const selectTicketResponse = await axios.post(selectTicketUrl, {
      _token: csrfToken,
      ticket_id: ticketId,
      quantity: quantity
    }, {
      headers: {
        ...API_CONFIG.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'Referer': eventUrl
      },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });
    
    // 5. Extract checkout page or handle redirect
    let checkoutUrl = '';
    if (selectTicketResponse.status === 302 && selectTicketResponse.headers.location) {
      checkoutUrl = selectTicketResponse.headers.location;
    } else {
      // Try to extract the checkout URL from the response HTML
      const selectResponseHtml = selectTicketResponse.data;
      const $select = cheerio.load(selectResponseHtml);
      const checkoutForm = $select('form[action*="checkout"]');
      if (checkoutForm.length) {
        checkoutUrl = checkoutForm.attr('action') || '';
      }
    }
    
    if (!checkoutUrl) {
      logger.warn('Could not determine checkout URL, using fallback');
      checkoutUrl = `${eventUrl}/checkout`;
    }
    
    logger.info(`Proceeding to checkout at: ${checkoutUrl}`);
    
    // 6. Submit checkout information
    const checkoutResponse = await axios.post(checkoutUrl, {
      _token: csrfToken,
      name: process.env.WEBOOK_NAME || process.env.WEBOOK_EMAIL.split('@')[0],
      email: process.env.WEBOOK_EMAIL,
      payment_method: 'card'
    }, {
      headers: {
        ...API_CONFIG.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'Referer': checkoutUrl
      }
    });
    
    if (checkoutResponse.status === 200 || checkoutResponse.status === 302) {
      logger.info('Checkout successful!');
      
      // Try to extract order info from the response
      const $checkout = cheerio.load(checkoutResponse.data);
      const orderNumber = $checkout('.order-number, [data-testid="order-number"]').text().trim() || 'Unknown';
      
      return {
        success: true,
        orderNumber,
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error(`Checkout failed with status: ${checkoutResponse.status}`);
    }
  } catch (error) {
    logger.error('Error during ticket purchase:', error);
    return { success: false, error: error.message };
  }
}

// Main function to check for tickets and purchase them if available
async function checkAndPurchaseTickets(eventUrl) {
  try {
    // Parse event URL to get the event ID
    const { eventId } = parseEventUrl(eventUrl);
    
    // Try API-based check first (faster)
    let apiResult = await checkTicketsViaApi(eventId);
    
    // If API check fails or shows no tickets, try HTTP-based check
    if (!apiResult.available || apiResult.error) {
      logger.info('Trying HTTP-based ticket check');
      const httpResult = await checkTicketsViaHttp(eventUrl);
      
      // Use HTTP-based result if it shows tickets are available
      if (httpResult.available) {
        apiResult = httpResult;
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
    
    const purchaseResult = await purchaseTicketsViaHttp(eventUrl, ticketCategory, quantity);
    
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