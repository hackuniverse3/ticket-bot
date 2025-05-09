const express = require('express');
const path = require('path');
const schedulerService = require('./services/scheduler');
const logger = require('./utils/logger');
const config = require('./config/config');

// Create Express app
const app = express();
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.post('/api/monitor', async (req, res) => {
  try {
    const { name, date, quantity } = req.body;
    
    // Validate input
    if (!name || !date || !quantity) {
      return res.status(400).json({ error: 'Match name, date, and ticket quantity are required' });
    }
    
    // Schedule ticket monitoring
    const taskId = schedulerService.scheduleTicketMonitoring({
      name,
      date,
      quantity: parseInt(quantity, 10)
    });
    
    return res.status(200).json({ 
      success: true, 
      taskId,
      message: `Started monitoring for ${name} on ${date} for ${quantity} tickets`
    });
  } catch (error) {
    logger.error(`Error in monitor endpoint: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/status', (req, res) => {
  try {
    const tasks = schedulerService.scheduledTasks.map(task => ({
      id: task.id,
      match: task.matchInfo.name,
      date: task.matchInfo.date,
      quantity: task.matchInfo.quantity,
      purchased: schedulerService.isPurchased
    }));
    
    return res.status(200).json({ 
      tasks,
      isPurchased: schedulerService.isPurchased
    });
  } catch (error) {
    logger.error(`Error in status endpoint: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/monitor/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = schedulerService.stopTask(taskId);
    
    if (success) {
      return res.status(200).json({ 
        success: true,
        message: `Stopped monitoring task ${taskId}`
      });
    } else {
      return res.status(404).json({ 
        success: false,
        message: `Task ${taskId} not found`
      });
    }
  } catch (error) {
    logger.error(`Error in delete task endpoint: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve the main interface for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize services and start the app
async function start() {
  try {
    // Create necessary directories
    const fs = require('fs');
    if (!fs.existsSync(path.join(__dirname, 'public'))) {
      fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
    }
    
    // Initialize scheduler service
    const initSuccess = await schedulerService.initialize();
    
    if (!initSuccess) {
      logger.error('Failed to initialize services, exiting');
      process.exit(1);
    }
    
    // Start the Express server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Ticket bot server running on port ${port}`);
      logger.info(`Web interface available at http://localhost:${port}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await schedulerService.cleanup();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await schedulerService.cleanup();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Error starting application: ${error.message}`);
    process.exit(1);
  }
}

// Start the application
start(); 