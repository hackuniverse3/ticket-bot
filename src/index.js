const express = require('express');
const config = require('config');
const cron = require('node-cron');
const logger = require('./utils/logger');
const TicketBot = require('./bot/ticketBot');
const EventFinder = require('./bot/eventFinder');
const { initializeStatus, updateStatus, getStatus } = require('./utils/status');
const fs = require('fs');
const path = require('path');

// Initialize the express application
const app = express();
const PORT = process.env.PORT || config.get('server.port');
const HOST = process.env.HOST || config.get('server.host');

// Load environment variables for configuration
if (process.env.LOGIN_EMAIL && process.env.LOGIN_PASSWORD) {
  // Set login credentials from environment variables
  config.util.setPath('loginInfo.email', process.env.LOGIN_EMAIL);
  config.util.setPath('loginInfo.password', process.env.LOGIN_PASSWORD);
  logger.info('Loaded login credentials from environment variables');
}

// Load payment info from environment variables if available
if (process.env.CARD_NUMBER) {
  config.util.setPath('paymentInfo.cardNumber', process.env.CARD_NUMBER);
  config.util.setPath('paymentInfo.expiryDate', process.env.EXPIRY_DATE);
  config.util.setPath('paymentInfo.cvv', process.env.CVV);
  config.util.setPath('paymentInfo.firstName', process.env.FIRST_NAME);
  config.util.setPath('paymentInfo.lastName', process.env.LAST_NAME);
  config.util.setPath('paymentInfo.email', process.env.EMAIL);
  logger.info('Loaded payment information from environment variables');
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure logs directory exists
const logDir = path.dirname(config.get('logging.file'));
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Initialize bot status
initializeStatus();

// Create ticket bot instances for each configured match
let ticketBots = [];
try {
  const matches = config.get('tickets.matches');
  if (Array.isArray(matches) && matches.length > 0) {
    ticketBots = matches.map(match => new TicketBot(match));
    logger.info(`Loaded ${ticketBots.length} match configurations`);
  } else {
    logger.info('No matches configured. Use the search page to add matches.');
  }
} catch (error) {
  logger.error(`Error loading match configurations: ${error.message}`);
}

// Event finder instance
const eventFinder = new EventFinder();

// Schedule ticket checking jobs
const refreshInterval = process.env.REFRESH_INTERVAL || config.get('refreshInterval');
const scheduleExpression = `*/${Math.ceil(refreshInterval / 60000)} * * * *`;

// Schedule job to check for tickets
cron.schedule(scheduleExpression, async () => {
  logger.info('Running scheduled ticket check');
  
  if (ticketBots.length === 0) {
    logger.info('No matches configured. Skipping ticket check.');
    return;
  }
  
  for (const bot of ticketBots) {
    try {
      await bot.checkAndPurchaseTickets();
      updateStatus(bot.matchName, { lastChecked: new Date(), status: 'success' });
    } catch (error) {
      logger.error(`Error checking tickets for ${bot.matchName}: ${error.message}`);
      updateStatus(bot.matchName, { lastChecked: new Date(), status: 'error', message: error.message });
    }
  }
});

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json(getStatus());
});

// Direct search endpoint for the search page
app.post('/api/search', async (req, res) => {
  try {
    const { searchTerm } = req.body;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }
    
    logger.info(`Direct search request for term: ${searchTerm}`);
    
    // Use the event finder to search
    const events = await eventFinder.findEvents(searchTerm);
    
    res.json({
      success: true,
      message: `Found ${events.length} events`,
      events: events
    });
  } catch (error) {
    logger.error(`Error in direct search: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Search failed: ${error.message}`
    });
  }
});

// Create a new match configuration from search
app.post('/api/create-match', async (req, res) => {
  try {
    const matchConfig = req.body;
    
    // Validate required fields
    if (!matchConfig.name || !matchConfig.team) {
      return res.status(400).json({
        success: false,
        message: 'Match name and team are required'
      });
    }
    
    // Check if match with same name already exists
    const existingMatch = ticketBots.find(bot => bot.matchName === matchConfig.name);
    if (existingMatch) {
      return res.status(400).json({
        success: false,
        message: `Match with name "${matchConfig.name}" already exists`
      });
    }
    
    // Prepare the new configuration
    const newMatchConfig = {
      name: matchConfig.name,
      url: matchConfig.url || '',
      searchTerm: matchConfig.searchTerm || matchConfig.name,
      team: matchConfig.team,
      preferredSeats: matchConfig.preferredSeats || {
        section: '',
        quantity: 5,
        adjacentSeats: true
      },
      alternative: matchConfig.alternative || {
        section: '',
        quantity: 5,
        adjacentSeats: true
      }
    };
    
    // Create a new bot instance
    const newBot = new TicketBot(newMatchConfig);
    ticketBots.push(newBot);
    
    // Update status
    initializeStatus();
    
    // Save to config file (in a real app, you would use environment variables or a database)
    try {
      // This is for demonstration purposes
      // In a production app, you should use a proper configuration management solution
      const configPath = path.resolve('config/matches.json');
      
      let matches = [];
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        matches = JSON.parse(fileContent);
      }
      
      matches.push(newMatchConfig);
      fs.writeFileSync(configPath, JSON.stringify(matches, null, 2));
      logger.info(`Saved new match configuration: ${newMatchConfig.name}`);
    } catch (saveError) {
      logger.warn(`Note: Could not save match configuration to file: ${saveError.message}`);
      // Continue anyway as we've already added the bot to memory
    }
    
    res.json({
      success: true,
      message: 'Match configuration created successfully',
      match: newMatchConfig
    });
  } catch (error) {
    logger.error(`Error creating match: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to create match: ${error.message}`
    });
  }
});

app.post('/api/config/update', (req, res) => {
  try {
    const { matchName, config } = req.body;
    const bot = ticketBots.find(b => b.matchName === matchName);
    
    if (!bot) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    bot.updateConfig(config);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error updating config: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/find-event', async (req, res) => {
  try {
    const { matchName, searchTerm } = req.body;
    const bot = ticketBots.find(b => b.matchName === matchName);
    
    if (!bot) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    // Use provided search term or the one from the bot config
    const searchTermToUse = searchTerm || bot.searchTerm;
    
    if (!searchTermToUse) {
      return res.status(400).json({ 
        success: false, 
        message: 'No search term provided' 
      });
    }
    
    // Find events using the search term
    const events = await eventFinder.findEvents(searchTermToUse);
    
    if (events.length === 0) {
      return res.json({ 
        success: false, 
        message: `No events found matching "${searchTermToUse}"` 
      });
    }
    
    // Get the first event
    const event = events[0];
    
    // Update the bot's URL
    const url = event.url.replace(bot.baseUrl, '');
    bot.url = url;
    
    // Update in status
    updateStatus(bot.matchName, { 
      config: {
        ...getStatus().matches[bot.matchName].config,
        url: url
      },
      message: `Found event: ${event.title}`
    });
    
    res.json({ 
      success: true, 
      message: `Found event: ${event.title}`,
      url: url,
      event: event
    });
  } catch (error) {
    logger.error(`Error finding event: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

app.post('/api/run-now', async (req, res) => {
  try {
    const { matchName } = req.body;
    const bot = ticketBots.find(b => b.matchName === matchName);
    
    if (!bot) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    // Run the bot asynchronously and return immediately
    res.json({ success: true, message: 'Bot started running' });
    
    try {
      await bot.checkAndPurchaseTickets();
      updateStatus(bot.matchName, { lastChecked: new Date(), status: 'success' });
    } catch (error) {
      logger.error(`Error running bot for ${bot.matchName}: ${error.message}`);
      updateStatus(bot.matchName, { lastChecked: new Date(), status: 'error', message: error.message });
    }
  } catch (error) {
    logger.error(`Error running bot: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Ticket bot scheduled to check tickets every ${Math.ceil(refreshInterval / 60000)} minutes`);
}); 