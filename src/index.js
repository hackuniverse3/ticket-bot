require('dotenv').config();
const { startTicketMonitoring } = require('./monitor');
const { setupWebServer } = require('./server');
const logger = require('./utils/logger');

async function main() {
  logger.info('Starting Webook Ticket Bot...');
  
  // Start the web server for status monitoring and control
  const port = process.env.PORT || 3000;
  setupWebServer(port);
  
  // Start monitoring for tickets
  await startTicketMonitoring();
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

main().catch(error => {
  logger.error('Error in main:', error);
  process.exit(1);
}); 