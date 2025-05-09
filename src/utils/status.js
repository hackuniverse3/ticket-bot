const config = require('config');

// In-memory status object
let statusData = {
  matches: {},
  system: {
    startedAt: new Date(),
    status: 'running'
  }
};

/**
 * Initialize status for all configured matches
 */
function initializeStatus() {
  try {
    const matches = config.get('tickets.matches');
    
    // Clear existing matches
    statusData.matches = {};
    
    if (Array.isArray(matches) && matches.length > 0) {
      matches.forEach(match => {
        statusData.matches[match.name] = {
          lastChecked: null,
          status: 'idle',
          message: 'Initialized',
          config: {
            team: match.team,
            preferredSeats: match.preferredSeats,
            alternative: match.alternative,
            searchTerm: match.searchTerm || match.name,
            url: match.url || ''
          }
        };
      });
    }
  } catch (error) {
    console.error(`Error initializing status: ${error.message}`);
  }
}

/**
 * Update the status of a specific match
 * @param {string} matchName - Name of the match to update
 * @param {object} status - Status update information
 */
function updateStatus(matchName, status) {
  if (!statusData.matches[matchName]) {
    statusData.matches[matchName] = {};
  }
  
  statusData.matches[matchName] = {
    ...statusData.matches[matchName],
    ...status
  };
}

/**
 * Get the current status of all bots
 * @returns {object} Complete status object
 */
function getStatus() {
  return {
    ...statusData,
    system: {
      ...statusData.system,
      uptime: Math.floor((new Date() - statusData.system.startedAt) / 1000)
    }
  };
}

module.exports = {
  initializeStatus,
  updateStatus,
  getStatus
}; 