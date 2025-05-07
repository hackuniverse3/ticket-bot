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

// Store session cookies for reuse
let sessionCookies = '';

// Function to search for events on webook.com
async function searchEvents(query) {
  try {
    logger.info(`Searching for events matching: ${query}`);
    
    // First, try the API endpoint
    try {
      const apiResponse = await axios.get(`${API_CONFIG.baseUrl}/events/search`, {
        params: { q: query },
        headers: API_CONFIG.headers
      });
      
      if (apiResponse.status === 200 && apiResponse.data && Array.isArray(apiResponse.data.events)) {
        return apiResponse.data.events.map(event => ({
          id: event.id,
          title: event.title,
          date: event.date,
          url: `https://webook.com/en/events/${event.slug}-${event.id}`,
          available: event.available
        }));
      }
    } catch (apiError) {
      logger.warn('API search failed, will try HTML search:', apiError.message);
    }
    
    // Fallback to HTML search
    const searchUrl = `https://webook.com/en/search?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      const results = [];
      
      // Look for event cards/listings
      $('.event-card, .event-item, .search-result').each((i, el) => {
        const titleEl = $(el).find('.title, .event-title, h3');
        const linkEl = $(el).find('a[href*="/events/"]');
        const dateEl = $(el).find('.date, .event-date');
        const availableEl = $(el).find('.availability, .status');
        
        const title = titleEl.length ? titleEl.text().trim() : '';
        const url = linkEl.length ? linkEl.attr('href') : '';
        const date = dateEl.length ? dateEl.text().trim() : '';
        const available = availableEl.length ? !availableEl.text().includes('Sold Out') : true;
        
        // Extract ID from URL
        let id = '';
        if (url) {
          const urlObj = parseEventUrl(url);
          id = urlObj.eventId;
        }
        
        if (title && url) {
          // Make sure URL is absolute
          const fullUrl = url.startsWith('http') ? url : `https://webook.com${url.startsWith('/') ? '' : '/'}${url}`;
          
          results.push({
            id,
            title,
            date,
            url: fullUrl,
            available
          });
        }
      });
      
      return results;
    }
    
    return [];
  } catch (error) {
    logger.error('Error searching for events:', error);
    return [];
  }
}

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
      const ticketButtons = $('.ticket-category, .book-button, [data-testid="buy-ticket-button"], .btn-buy-ticket');
      
      if (ticketButtons.length > 0) {
        logger.info('Tickets appear to be available (HTML indicators found)');
        
        // Extract ticket categories if possible
        const ticketCategories = [];
        $('.ticket-category, .ticket-item, .ticket-option').each((i, el) => {
          const nameEl = $(el).find('.name, .ticket-name');
          const priceEl = $(el).find('.price, .ticket-price');
          const availabilityEl = $(el).find('.availability, .status');
          const ticketId = $(el).data('id') || $(el).attr('id') || '';
          
          ticketCategories.push({
            id: ticketId,
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

// Login to webook.com
async function loginToWebook() {
  try {
    logger.info('Attempting to log in to webook.com');
    
    const loginUrl = 'https://webook.com/en/login';
    
    // First, get the login page to extract CSRF token
    const loginPageResponse = await axios.get(loginUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });
    
    if (loginPageResponse.status !== 200) {
      throw new Error(`Failed to load login page, status: ${loginPageResponse.status}`);
    }
    
    const $ = cheerio.load(loginPageResponse.data);
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                      $('input[name="_token"]').val() || '';
    
    if (!csrfToken) {
      logger.warn('CSRF token not found on login page');
    }
    
    // Create form data for login
    const formData = new URLSearchParams();
    formData.append('email', process.env.WEBOOK_EMAIL);
    formData.append('password', process.env.WEBOOK_PASSWORD);
    formData.append('_token', csrfToken);
    
    // Submit login request
    const loginResponse = await axios.post(loginUrl, formData, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginUrl
      },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });
    
    // Check if we have cookies
    if (loginResponse.headers['set-cookie']) {
      sessionCookies = loginResponse.headers['set-cookie'].join('; ');
      logger.info('Login successful, cookies obtained');
      return true;
    }
    
    // Check if login was successful by looking at the response URL or content
    const responseUrl = loginResponse.request?.res?.responseUrl || '';
    if (responseUrl && !responseUrl.includes('login')) {
      logger.info('Login successful based on redirect URL');
      return true;
    }
    
    // Check for error messages in the response
    const $response = cheerio.load(loginResponse.data);
    const errorMessages = $response('.alert-danger, .error-message').text().trim();
    
    if (errorMessages) {
      logger.error(`Login failed with message: ${errorMessages}`);
      return false;
    }
    
    logger.warn('Login status unclear, proceeding anyway');
    return true;
  } catch (error) {
    logger.error('Error during login:', error);
    return false;
  }
}

// Enhanced seat selection with aggressive preference handling
async function selectSeats(eventUrl, seatSelectionPage, seatPreferences) {
  try {
    logger.info('Attempting to select seats with aggressive preference handling');
    
    // Load the seat selection page
    const response = await axios.get(seatSelectionPage, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Cookie': sessionCookies,
        'Referer': eventUrl
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Failed to load seat selection page, status: ${response.status}`);
    }
    
    const $ = cheerio.load(response.data);
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                      $('input[name="_token"]').val() || '';
    
    // Quick seat detection - focus on available seats only
    const availableSeats = [];
    $('.seat:not(.taken), .seat-item:not(.unavailable), [data-seat-available="true"], .available-seat').each((i, el) => {
      const seatId = $(el).data('id') || $(el).attr('id') || '';
      const seatSection = $(el).data('section') || $(el).closest('.section').data('section') || '';
      
      availableSeats.push({
        id: seatId,
        section: seatSection
      });
    });
    
    if (availableSeats.length === 0) {
      logger.warn('No available seats found on seat selection page');
      return null;
    }
    
    // Aggressive seat selection
    let selectedSeats = [];
    const quantity = parseInt(process.env.NUMBER_OF_TICKETS || '1', 10);
    
    // Try primary section first
    if (seatPreferences.primary) {
      const primarySection = seatPreferences.primary.toLowerCase();
      const primarySeats = availableSeats.filter(seat => 
        seat.section.toLowerCase().includes(primarySection)
      );
      
      if (primarySeats.length >= quantity) {
        selectedSeats = primarySeats.slice(0, quantity);
        logger.info(`Selected ${selectedSeats.length} seats in primary section`);
      }
    }
    
    // If primary section didn't yield enough seats, try secondary section
    if (selectedSeats.length < quantity && seatPreferences.secondary) {
      const secondarySection = seatPreferences.secondary.toLowerCase();
      const remainingSeats = availableSeats.filter(seat => 
        !selectedSeats.some(selected => selected.id === seat.id) &&
        seat.section.toLowerCase().includes(secondarySection)
      );
      
      const remainingNeeded = quantity - selectedSeats.length;
      if (remainingSeats.length >= remainingNeeded) {
        selectedSeats = [
          ...selectedSeats,
          ...remainingSeats.slice(0, remainingNeeded)
        ];
        logger.info(`Added ${remainingNeeded} seats from secondary section`);
      }
    }
    
    // If we still don't have enough seats, take any available seats
    if (selectedSeats.length < quantity) {
      const remainingSeats = availableSeats.filter(seat => 
        !selectedSeats.some(selected => selected.id === seat.id)
      );
      
      const remainingNeeded = quantity - selectedSeats.length;
      selectedSeats = [
        ...selectedSeats,
        ...remainingSeats.slice(0, remainingNeeded)
      ];
      logger.info(`Added ${remainingNeeded} seats from any available section`);
    }
    
    // Quick form submission
    const formData = new URLSearchParams();
    formData.append('_token', csrfToken);
    selectedSeats.forEach((seat, index) => {
      formData.append(`seats[${index}]`, seat.id);
    });
    
    const formAction = $('form[action*="seats"]').attr('action') || 
                      `${eventUrl}/select-seats`;
    
    // Submit seat selection with minimal retries
    let submitResponse;
    let retryCount = 0;
    const maxRetries = 2; // Reduced retries for speed
    
    while (retryCount < maxRetries) {
      try {
        submitResponse = await axios.post(formAction, formData, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': sessionCookies,
            'Referer': seatSelectionPage
          },
          maxRedirects: 0,
          validateStatus: status => status >= 200 && status < 400
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount)); // Reduced delay
      }
    }
    
    // Quick response handling
    if (submitResponse.status === 302 && submitResponse.headers.location) {
      return submitResponse.headers.location;
    }
    
    const $submit = cheerio.load(submitResponse.data);
    const nextForm = $submit('form[action*="checkout"]');
    if (nextForm.length) {
      return nextForm.attr('action') || null;
    }
    
    return null;
  } catch (error) {
    logger.error('Error during seat selection:', error);
    return null;
  }
}

// Function to purchase tickets via HTTP POST requests
async function purchaseTicketsViaHttp(eventUrl, ticketCategory, quantity, seatPreferences) {
  try {
    logger.info(`Attempting to purchase tickets via HTTP for ${eventUrl}`);
    logger.info(`Ticket category: ${ticketCategory}, Quantity: ${quantity}`);
    
    // 1. First, ensure we are logged in with retry logic
    let isLoggedIn = false;
    let loginRetryCount = 0;
    const maxLoginRetries = 3;
    
    while (loginRetryCount < maxLoginRetries && !isLoggedIn) {
      isLoggedIn = await loginToWebook();
      if (!isLoggedIn) {
        loginRetryCount++;
        if (loginRetryCount === maxLoginRetries) {
          throw new Error('Failed to log in to webook.com after multiple attempts');
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * loginRetryCount));
      }
    }
    
    // 2. Get the event page with retry logic
    let pageResponse;
    let pageRetryCount = 0;
    const maxPageRetries = 3;
    
    while (pageRetryCount < maxPageRetries) {
      try {
        pageResponse = await axios.get(eventUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': sessionCookies
          }
        });
        break;
      } catch (error) {
        pageRetryCount++;
        if (pageRetryCount === maxPageRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * pageRetryCount));
      }
    }
    
    if (pageResponse.status !== 200) {
      throw new Error(`Failed to load event page, status: ${pageResponse.status}`);
    }
    
    const $ = cheerio.load(pageResponse.data);
    
    // 3. Extract necessary form data and tokens with enhanced detection
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                      $('input[name="_token"]').val() || 
                      $('input[name="csrf-token"]').val() || '';
    
    const eventId = $('input[name="event_id"]').val() || 
                   $('[data-event-id]').data('event-id') || 
                   parseEventUrl(eventUrl).eventId;
    
    // Enhanced ticket category detection
    let ticketId = '';
    let ticketPrice = '';
    let ticketName = '';
    
    if (ticketCategory && ticketCategory !== 'General') {
      $('.ticket-category, .ticket-item, .ticket-option, [data-ticket-type]').each((i, el) => {
        const name = $(el).find('.name, .ticket-name, [data-ticket-name]').text().trim();
        const price = $(el).find('.price, .ticket-price, [data-ticket-price]').text().trim();
        
        if (name.toLowerCase().includes(ticketCategory.toLowerCase())) {
          ticketId = $(el).data('id') || $(el).attr('id') || $(el).data('ticket-id') || '';
          ticketPrice = price;
          ticketName = name;
        }
      });
    } else {
      // Get the first available ticket with price information
      const firstTicket = $('.ticket-category, .ticket-item, .ticket-option, [data-ticket-type]').first();
      if (firstTicket.length) {
        ticketId = firstTicket.data('id') || firstTicket.attr('id') || firstTicket.data('ticket-id') || '';
        ticketPrice = firstTicket.find('.price, .ticket-price, [data-ticket-price]').text().trim();
        ticketName = firstTicket.find('.name, .ticket-name, [data-ticket-name]').text().trim();
      }
    }
    
    if (!ticketId) {
      logger.warn('Could not identify ticket ID, will try to proceed with the first available option');
      // Enhanced buy button detection
      const buyButton = $('.buy-button, .book-button, [data-testid="buy-ticket-button"], .btn-buy-ticket, [data-action="buy-ticket"]').first();
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
    
    logger.info(`Selected ticket: ${ticketName} (ID: ${ticketId}, Price: ${ticketPrice})`);
    
    // 4. Submit initial ticket selection with retry logic
    let selectionResponse;
    let selectionRetryCount = 0;
    const maxSelectionRetries = 3;
    
    while (selectionRetryCount < maxSelectionRetries) {
      try {
        const selectionData = new URLSearchParams();
        selectionData.append('_token', csrfToken);
        selectionData.append('event_id', eventId);
        selectionData.append('ticket_id', ticketId);
        selectionData.append('quantity', quantity);
        
        selectionResponse = await axios.post(`${eventUrl}/select-tickets`, selectionData, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': sessionCookies,
            'Referer': eventUrl
          },
          maxRedirects: 0,
          validateStatus: status => status >= 200 && status < 400
        });
        break;
      } catch (error) {
        selectionRetryCount++;
        if (selectionRetryCount === maxSelectionRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * selectionRetryCount));
      }
    }
    
    // 5. Handle seat selection if required
    let seatSelectionUrl = null;
    if (selectionResponse.status === 302 && selectionResponse.headers.location) {
      seatSelectionUrl = selectionResponse.headers.location;
    } else {
      const $selection = cheerio.load(selectionResponse.data);
      const seatSelectionForm = $selection('form[action*="seats"]');
      if (seatSelectionForm.length) {
        seatSelectionUrl = seatSelectionForm.attr('action');
      }
    }
    
    if (seatSelectionUrl) {
      logger.info('Seat selection required, proceeding to seat selection page');
      const checkoutUrl = await selectSeats(eventUrl, seatSelectionUrl, seatPreferences);
      if (!checkoutUrl) {
        throw new Error('Failed to complete seat selection');
      }
      return checkoutUrl;
    }
    
    // 6. If no seat selection required, proceed to checkout
    const $selection = cheerio.load(selectionResponse.data);
    const checkoutForm = $selection('form[action*="checkout"]');
    if (checkoutForm.length) {
      return checkoutForm.attr('action');
    }
    
    // Try to find checkout URL in redirect
    if (selectionResponse.status === 302 && selectionResponse.headers.location) {
      return selectionResponse.headers.location;
    }
    
    throw new Error('Could not determine checkout URL');
  } catch (error) {
    logger.error('Error during ticket purchase:', error);
    throw error;
  }
}

async function completeCheckout(checkoutUrl) {
  try {
    logger.info(`Completing checkout at: ${checkoutUrl}`);
    
    // 1. Get checkout page to extract form data
    let checkoutPageResponse;
    let pageRetryCount = 0;
    const maxPageRetries = 3;
    
    while (pageRetryCount < maxPageRetries) {
      try {
        checkoutPageResponse = await axios.get(checkoutUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Cookie': sessionCookies
          }
        });
        break;
      } catch (error) {
        pageRetryCount++;
        if (pageRetryCount === maxPageRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * pageRetryCount));
      }
    }
    
    const $ = cheerio.load(checkoutPageResponse.data);
    
    // 2. Extract form data and tokens
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                      $('input[name="_token"]').val() || 
                      $('input[name="csrf-token"]').val() || '';
    
    // 3. Prepare checkout data
    const checkoutData = new URLSearchParams();
    checkoutData.append('_token', csrfToken);
    checkoutData.append('name', process.env.WEBOOK_NAME || process.env.WEBOOK_EMAIL.split('@')[0]);
    checkoutData.append('email', process.env.WEBOOK_EMAIL);
    checkoutData.append('payment_method', 'card');
    
    // Add any additional required fields
    $('form[action*="checkout"] input[type="hidden"]').each((i, el) => {
      const name = $(el).attr('name');
      const value = $(el).val();
      if (name && value && !checkoutData.has(name)) {
        checkoutData.append(name, value);
      }
    });
    
    // 4. Submit checkout with retry logic
    let checkoutResponse;
    let checkoutRetryCount = 0;
    const maxCheckoutRetries = 3;
    
    while (checkoutRetryCount < maxCheckoutRetries) {
      try {
        checkoutResponse = await axios.post(checkoutUrl, checkoutData, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': sessionCookies,
            'Referer': checkoutUrl
          },
          maxRedirects: 2  // Allow a couple of redirects for payment processing
        });
        break;
      } catch (error) {
        checkoutRetryCount++;
        if (checkoutRetryCount === maxCheckoutRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * checkoutRetryCount));
      }
    }
    
    // 5. Process checkout response
    if (checkoutResponse.status === 200 || checkoutResponse.status === 302) {
      logger.info('Checkout successful!');
      
      // Try to extract order info from the response
      const $checkout = cheerio.load(checkoutResponse.data);
      const orderNumber = $checkout('.order-number, [data-testid="order-number"], .confirmation-id').text().trim() || 'Unknown';
      const orderStatus = $checkout('.order-status, [data-testid="order-status"]').text().trim() || 'Confirmed';
      
      // Check for success indicators
      const successIndicators = [
        $checkout('.success-message, .confirmation-message').length > 0,
        $checkout('h1, h2').text().toLowerCase().includes('thank you'),
        $checkout('h1, h2').text().toLowerCase().includes('confirmation'),
        orderStatus.toLowerCase().includes('confirmed'),
        orderStatus.toLowerCase().includes('success')
      ];
      
      const isSuccess = successIndicators.some(indicator => indicator);
      
      if (!isSuccess) {
        throw new Error('Checkout response did not indicate success');
      }
      
      return {
        success: true,
        orderNumber,
        orderStatus,
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error(`Checkout failed with status: ${checkoutResponse.status}`);
    }
  } catch (error) {
    logger.error('Error during checkout:', error);
    throw error;
  }
}

// Main function to check for tickets and purchase them if available
async function checkAndPurchaseTickets(eventUrl) {
  try {
    logger.info(`Starting ticket purchase process for ${eventUrl}`);
    
    // 1. Check ticket availability
    const availability = await checkTicketsViaHttp(eventUrl);
    if (!availability.available) {
      logger.info('Tickets are not available');
      return { success: false, reason: 'Tickets not available' };
    }
    
    // 2. Purchase tickets
    const checkoutUrl = await purchaseTicketsViaHttp(
      eventUrl,
      process.env.TICKET_CATEGORY || 'General',
      parseInt(process.env.NUMBER_OF_TICKETS || '1', 10),
      {
        primary: process.env.PRIMARY_SEAT_PREFERENCE,
        secondary: process.env.SECONDARY_SEAT_PREFERENCE
      }
    );
    
    if (!checkoutUrl) {
      throw new Error('Failed to get checkout URL');
    }
    
    // 3. Complete checkout
    const result = await completeCheckout(checkoutUrl);
    
    logger.info('Ticket purchase completed successfully!', result);
    return result;
  } catch (error) {
    logger.error('Error in ticket purchase process:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  checkAndPurchaseTickets,
  parseEventUrl,
  searchEvents
}; 