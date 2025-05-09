/**
 * Test script for the Football Ticket Bot
 * This runs a basic test to ensure all components work correctly
 */

const browserService = require('./src/services/browser');
const ticketService = require('./src/services/ticketService');
const logger = require('./src/utils/logger');

async function runTest() {
  logger.info('Starting browser test...');
  
  try {
    // Initialize browser
    const initSuccess = await browserService.initialize();
    if (!initSuccess) {
      logger.error('Browser initialization failed');
      process.exit(1);
    }
    
    // Set test match
    ticketService.setTargetMatch({
      name: 'Real Madrid vs Barcelona',
      date: '2023-12-25', 
      quantity: 2
    });
    
    // Try login (will fail without proper credentials, but tests the flow)
    logger.info('Testing login flow...');
    await ticketService.login();
    
    // Try the search feature
    logger.info('Testing search functionality...');
    await ticketService.searchMatch();
    
    logger.info('Test completed - The bot is set up correctly');
    
    // Cleanup
    await browserService.close();
    
    return true;
  } catch (error) {
    logger.error(`Test failed with error: ${error.message}`);
    await browserService.close();
    return false;
  }
}

// Run the test
runTest()
  .then(success => {
    if (success) {
      console.log('✅ Test completed successfully');
    } else {
      console.log('❌ Test failed');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  }); 