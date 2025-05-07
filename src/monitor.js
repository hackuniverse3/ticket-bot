const cron = require('node-cron');
const { checkAndPurchaseTickets } = require('./ticketService');
const logger = require('./utils/logger');

let monitoringJob = null;
const ticketStatus = {
  isRunning: false,
  lastCheck: null,
  lastCheckResult: null,
  ticketsFound: false,
  purchaseAttempts: 0,
  successfulPurchases: 0
};

// Convert seconds to cron expression
const secondsToCron = (seconds) => {
  if (seconds < 60) {
    return `*/${seconds} * * * * *`; // Every X seconds
  } else {
    const minutes = Math.floor(seconds / 60);
    return `0 */${minutes} * * * *`; // Every X minutes
  }
};

async function startTicketMonitoring() {
  const targetUrl = process.env.TARGET_EVENT_URL;
  const interval = parseInt(process.env.MONITOR_INTERVAL || '60', 10);
  
  if (!targetUrl) {
    logger.error('No target event URL specified in .env file');
    return;
  }
  
  logger.info(`Starting ticket monitoring for ${targetUrl}`);
  logger.info(`Checking every ${interval} seconds`);
  
  // Schedule the job
  const cronExpression = secondsToCron(interval);
  ticketStatus.isRunning = true;
  
  monitoringJob = cron.schedule(cronExpression, async () => {
    try {
      ticketStatus.lastCheck = new Date();
      logger.info('Checking for available tickets...');
      
      const result = await checkAndPurchaseTickets(targetUrl);
      
      ticketStatus.lastCheckResult = result;
      if (result.ticketsAvailable) {
        ticketStatus.ticketsFound = true;
        ticketStatus.purchaseAttempts++;
        
        if (result.purchaseSuccessful) {
          ticketStatus.successfulPurchases++;
          logger.info('Tickets purchased successfully!');
        } else {
          logger.info('Tickets not purchased.');
        }
      } else {
        logger.info('No tickets found.');
      }
    } catch (error) {
      logger.error('Error checking for tickets:', error);
    }
  });
  
  return ticketStatus;
}

function stopTicketMonitoring() {
  if (monitoringJob) {
    monitoringJob.stop();
    ticketStatus.isRunning = false;
    logger.info('Ticket monitoring stopped');
    return true;
  }
  return false;
}

function getTicketStatus() {
  return ticketStatus;
}

module.exports = {
  startTicketMonitoring,
  stopTicketMonitoring,
  getTicketStatus
}; 