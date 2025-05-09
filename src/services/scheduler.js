const cron = require('node-cron');
const logger = require('../utils/logger');
const config = require('../config/config');
const ticketService = require('./ticketService');
const browserService = require('./browser');

class SchedulerService {
  constructor() {
    this.scheduledTasks = [];
    this.isPurchased = false;
  }

  /**
   * Initialize the scheduler
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      const browserInitSuccess = await browserService.initialize();
      if (!browserInitSuccess) {
        logger.error('Failed to initialize browser');
        return false;
      }
      
      logger.info('Scheduler service initialized');
      return true;
    } catch (error) {
      logger.error(`Error initializing scheduler: ${error.message}`);
      return false;
    }
  }

  /**
   * Schedule ticket monitoring for a match
   * @param {Object} matchInfo - Information about the match
   * @returns {string} - ID of the scheduled task
   */
  scheduleTicketMonitoring(matchInfo) {
    logger.info(`Scheduling ticket monitoring for ${matchInfo.name} on ${matchInfo.date}`);
    
    ticketService.setTargetMatch(matchInfo);
    
    // Create a unique ID for this task
    const taskId = `ticket-monitor-${Date.now()}`;
    
    // Schedule the task using node-cron
    const task = cron.schedule(config.scheduler.checkInterval, async () => {
      if (this.isPurchased) {
        logger.info('Tickets already purchased, skipping check');
        return;
      }
      
      logger.info(`Running scheduled check for ${matchInfo.name}`);
      const success = await ticketService.monitorAndPurchase();
      
      if (success) {
        logger.info('Purchase completed successfully, stopping monitoring');
        this.isPurchased = true;
        this.stopTask(taskId);
      }
    });
    
    // Store the task
    this.scheduledTasks.push({
      id: taskId,
      task,
      matchInfo
    });
    
    logger.info(`Scheduled task ${taskId} for ${matchInfo.name}`);
    return taskId;
  }

  /**
   * Stop a scheduled task
   * @param {string} taskId - ID of the task to stop
   * @returns {boolean} - Whether the task was stopped
   */
  stopTask(taskId) {
    const taskIndex = this.scheduledTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      logger.warn(`Task ${taskId} not found`);
      return false;
    }
    
    const task = this.scheduledTasks[taskIndex];
    task.task.stop();
    
    logger.info(`Stopped task ${taskId} for ${task.matchInfo.name}`);
    
    // Remove the task from the array
    this.scheduledTasks.splice(taskIndex, 1);
    
    return true;
  }

  /**
   * Stop all scheduled tasks
   */
  stopAllTasks() {
    logger.info('Stopping all scheduled tasks');
    
    this.scheduledTasks.forEach(task => {
      task.task.stop();
      logger.info(`Stopped task ${task.id} for ${task.matchInfo.name}`);
    });
    
    this.scheduledTasks = [];
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    logger.info('Cleaning up scheduler resources');
    
    this.stopAllTasks();
    await browserService.close();
    
    logger.info('Scheduler cleanup complete');
  }
}

module.exports = new SchedulerService(); 