const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { getTicketStatus, startTicketMonitoring, stopTicketMonitoring } = require('./monitor');
const logger = require('./utils/logger');

function setupWebServer(port) {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Serve static files
  app.use(express.static(path.join(__dirname, 'public')));
  
  // API routes
  app.get('/status', (req, res) => {
    const status = getTicketStatus();
    res.json({
      ...status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
  
  app.post('/control/start', (req, res) => {
    const status = getTicketStatus();
    
    if (status.isRunning) {
      return res.json({ message: 'Monitoring is already running', status });
    }
    
    startTicketMonitoring();
    res.json({ message: 'Monitoring started', status: getTicketStatus() });
  });
  
  app.post('/control/stop', (req, res) => {
    const status = getTicketStatus();
    
    if (!status.isRunning) {
      return res.json({ message: 'Monitoring is already stopped', status });
    }
    
    stopTicketMonitoring();
    res.json({ message: 'Monitoring stopped', status: getTicketStatus() });
  });
  
  // Config endpoints
  app.get('/config', (req, res) => {
    try {
      // Read current config from .env file
      const envPath = path.resolve(process.cwd(), '.env');
      let config = {};
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envConfig = dotenv.parse(envContent);
        
        // Filter out sensitive data for display
        config = {
          TARGET_EVENT_URL: envConfig.TARGET_EVENT_URL || '',
          NUMBER_OF_TICKETS: envConfig.NUMBER_OF_TICKETS || '1',
          MONITOR_INTERVAL: envConfig.MONITOR_INTERVAL || '10',
          TICKET_CATEGORY: envConfig.TICKET_CATEGORY || 'General',
          // Show only partial email for security
          WEBOOK_EMAIL: envConfig.WEBOOK_EMAIL ? 
            envConfig.WEBOOK_EMAIL.replace(/(.{2})(.*)(@.*)/, '$1****$3') : '',
          // Don't show password
          WEBOOK_PASSWORD: envConfig.WEBOOK_PASSWORD ? '********' : ''
        };
      }
      
      res.json({ config });
    } catch (error) {
      logger.error('Error reading config:', error);
      res.status(500).json({ error: 'Failed to read configuration' });
    }
  });
  
  app.post('/config', (req, res) => {
    try {
      const { email, password, eventUrl, tickets, interval, category } = req.body;
      
      // Update .env file
      const envPath = path.resolve(process.cwd(), '.env');
      const envVars = {
        WEBOOK_EMAIL: email,
        WEBOOK_PASSWORD: password,
        TARGET_EVENT_URL: eventUrl,
        NUMBER_OF_TICKETS: tickets,
        MONITOR_INTERVAL: interval,
        TICKET_CATEGORY: category,
        PORT: process.env.PORT || '3000'
      };
      
      // Create .env content
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Write to .env file
      fs.writeFileSync(envPath, envContent);
      
      // Reload environment variables
      Object.entries(envVars).forEach(([key, value]) => {
        process.env[key] = value;
      });
      
      res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
      logger.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });
  
  // Serve index.html for root route
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  // Start the server
  app.listen(port, () => {
    logger.info(`Web server running on port ${port}`);
  });
}

module.exports = { setupWebServer }; 