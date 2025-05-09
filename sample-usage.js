const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Start monitoring for a match
 * @param {string} name - Match name (e.g., "Real Madrid vs Barcelona")
 * @param {string} date - Match date (e.g., "2023-12-25")
 * @param {number} quantity - Number of tickets to purchase
 */
async function startMonitoring(name, date, quantity) {
  try {
    const response = await fetch(`${API_BASE_URL}/monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        date,
        quantity
      })
    });

    const data = await response.json();
    console.log('Started monitoring:', data);
    return data.taskId;
  } catch (error) {
    console.error('Error starting monitoring:', error.message);
  }
}

/**
 * Check the status of all monitoring tasks
 */
async function checkStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`);
    const data = await response.json();
    console.log('Current status:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error checking status:', error.message);
  }
}

/**
 * Stop monitoring for a specific task
 * @param {string} taskId - ID of the task to stop
 */
async function stopMonitoring(taskId) {
  try {
    const response = await fetch(`${API_BASE_URL}/monitor/${taskId}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    console.log('Stopped monitoring:', data);
    return data;
  } catch (error) {
    console.error('Error stopping monitoring:', error.message);
  }
}

/**
 * Example usage
 */
async function example() {
  // Start monitoring for a match
  const taskId = await startMonitoring(
    'Real Madrid vs Barcelona',
    '2023-12-25',
    2
  );

  // Check status after a short delay
  setTimeout(async () => {
    await checkStatus();

    // Stop monitoring after checking status
    if (taskId) {
      await stopMonitoring(taskId);
    }
  }, 2000);
}

// Run the example if this script is executed directly
if (require.main === module) {
  example();
} 