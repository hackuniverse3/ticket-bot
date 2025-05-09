// Global references
const matchCardsContainer = document.getElementById('match-cards');
const refreshBtn = document.getElementById('refresh-btn');
const configModal = new bootstrap.Modal(document.getElementById('configModal'));
const configForm = document.getElementById('configForm');
const saveConfigBtn = document.getElementById('save-config');
const findEventBtn = document.getElementById('find-event-btn');

// API endpoints
const API = {
  STATUS: '/api/status',
  UPDATE_CONFIG: '/api/config/update',
  RUN_NOW: '/api/run-now',
  FIND_EVENT: '/api/find-event'
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Initial data fetch
  fetchStatus();
  
  // Set up event listeners
  refreshBtn.addEventListener('click', fetchStatus);
  saveConfigBtn.addEventListener('click', saveConfiguration);
  findEventBtn.addEventListener('click', findEvent);
  
  // Set up periodic refresh
  setInterval(fetchStatus, 30000); // Refresh every 30 seconds
});

/**
 * Fetch status from the API
 */
async function fetchStatus() {
  try {
    const response = await fetch(API.STATUS);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    updateUI(data);
  } catch (error) {
    console.error('Error fetching status:', error);
    showError('Failed to fetch status data. Please check if the server is running.');
  }
}

/**
 * Update the UI with status data
 * @param {Object} data - Status data from API
 */
function updateUI(data) {
  // Update system status
  updateSystemStatus(data.system);
  
  // Update match cards
  updateMatchCards(data.matches);
}

/**
 * Update system status display
 * @param {Object} system - System status data
 */
function updateSystemStatus(system) {
  document.getElementById('system-status').textContent = system.status;
  document.getElementById('system-uptime').textContent = formatUptime(system.uptime);
  document.getElementById('system-started-at').textContent = formatDate(system.startedAt);
}

/**
 * Update match cards display
 * @param {Object} matches - Match status data
 */
function updateMatchCards(matches) {
  // Clear existing cards
  matchCardsContainer.innerHTML = '';
  
  // Add a card for each match
  Object.entries(matches).forEach(([matchName, matchData]) => {
    const card = createMatchCard(matchName, matchData);
    matchCardsContainer.appendChild(card);
  });
}

/**
 * Create a match card element
 * @param {string} matchName - Name of the match
 * @param {Object} matchData - Match status data
 * @returns {HTMLElement} The created card element
 */
function createMatchCard(matchName, matchData) {
  const colDiv = document.createElement('div');
  colDiv.className = 'col-md-6';
  
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card match-card';
  colDiv.appendChild(cardDiv);
  
  // Card header
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';
  cardHeader.innerHTML = `<h5>${matchName}</h5>`;
  cardDiv.appendChild(cardHeader);
  
  // Card body
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';
  cardDiv.appendChild(cardBody);
  
  // Status section
  const statusSection = document.createElement('div');
  statusSection.className = 'mb-3';
  statusSection.innerHTML = `
    <p>
      <span class="status-label">Status:</span> 
      <span class="badge status-${matchData.status}">${matchData.status}</span>
    </p>
    ${matchData.message ? `<p><small>${matchData.message}</small></p>` : ''}
    ${matchData.lastChecked ? 
      `<p class="timestamp">Last checked: ${formatDate(matchData.lastChecked)}</p>` : 
      '<p class="timestamp">Never checked</p>'}
  `;
  cardBody.appendChild(statusSection);
  
  // Configuration section
  const configSection = document.createElement('div');
  configSection.className = 'config-section';
  
  const config = matchData.config || {};
  const prefSeats = config.preferredSeats || {};
  const altSeats = config.alternative || {};
  
  configSection.innerHTML = `
    <h6>Configuration</h6>
    <p><small>Team: ${config.team || 'Not set'}</small></p>
    <p><small>Search Term: ${config.searchTerm || 'Not set'}</small></p>
    
    <div class="row">
      <div class="col-md-6">
        <p class="mb-1"><small>Preferred Seats:</small></p>
        <ul class="list-unstyled ps-2">
          <li><small>Section: ${prefSeats.section || 'Not set'}</small></li>
          <li><small>Quantity: ${prefSeats.quantity || '0'}</small></li>
          <li><small>Adjacent: ${prefSeats.adjacentSeats ? 'Yes' : 'No'}</small></li>
        </ul>
      </div>
      <div class="col-md-6">
        <p class="mb-1"><small>Alternative:</small></p>
        <ul class="list-unstyled ps-2">
          <li><small>Section: ${altSeats.section || 'Not set'}</small></li>
          <li><small>Quantity: ${altSeats.quantity || '0'}</small></li>
          <li><small>Adjacent: ${altSeats.adjacentSeats ? 'Yes' : 'No'}</small></li>
        </ul>
      </div>
    </div>
  `;
  cardBody.appendChild(configSection);
  
  // Action buttons
  const actionDiv = document.createElement('div');
  actionDiv.className = 'action-buttons';
  actionDiv.innerHTML = `
    <button class="btn btn-sm btn-primary edit-config-btn" data-match="${matchName}">Edit Config</button>
    <button class="btn btn-sm btn-info find-event-btn" data-match="${matchName}">Find Event</button>
    <button class="btn btn-sm btn-success run-now-btn" data-match="${matchName}">Run Now</button>
  `;
  cardBody.appendChild(actionDiv);
  
  // Add event listeners for buttons
  actionDiv.querySelector('.edit-config-btn').addEventListener('click', () => openConfigModal(matchName, matchData.config));
  actionDiv.querySelector('.find-event-btn').addEventListener('click', () => findEventForMatch(matchName));
  actionDiv.querySelector('.run-now-btn').addEventListener('click', () => runBotNow(matchName));
  
  return colDiv;
}

/**
 * Open the configuration modal
 * @param {string} matchName - Name of the match to configure
 * @param {Object} config - Current configuration
 */
function openConfigModal(matchName, config) {
  document.getElementById('match-name').value = matchName;
  
  // Set default values
  config = config || {};
  const prefSeats = config.preferredSeats || {};
  const altSeats = config.alternative || {};
  
  document.getElementById('team').value = config.team || '';
  document.getElementById('search-term').value = config.searchTerm || '';
  document.getElementById('pref-section').value = prefSeats.section || '';
  document.getElementById('pref-quantity').value = prefSeats.quantity || '5';
  document.getElementById('pref-adjacent').checked = prefSeats.adjacentSeats !== false;
  
  document.getElementById('alt-section').value = altSeats.section || '';
  document.getElementById('alt-quantity').value = altSeats.quantity || '5';
  document.getElementById('alt-adjacent').checked = altSeats.adjacentSeats !== false;
  
  configModal.show();
}

/**
 * Save the configuration form data
 */
async function saveConfiguration() {
  const matchName = document.getElementById('match-name').value;
  
  // Build configuration object
  const config = {
    team: document.getElementById('team').value,
    searchTerm: document.getElementById('search-term').value,
    preferredSeats: {
      section: document.getElementById('pref-section').value,
      quantity: parseInt(document.getElementById('pref-quantity').value),
      adjacentSeats: document.getElementById('pref-adjacent').checked
    },
    alternative: {
      section: document.getElementById('alt-section').value,
      quantity: parseInt(document.getElementById('alt-quantity').value),
      adjacentSeats: document.getElementById('alt-adjacent').checked
    }
  };
  
  try {
    const response = await fetch(API.UPDATE_CONFIG, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        matchName,
        config
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    // Close modal and refresh data
    configModal.hide();
    fetchStatus();
    
    showMessage('Configuration saved successfully');
  } catch (error) {
    console.error('Error saving configuration:', error);
    showError('Failed to save configuration');
  }
}

/**
 * Find event from modal
 */
async function findEvent() {
  const matchName = document.getElementById('match-name').value;
  const searchTerm = document.getElementById('search-term').value;
  
  if (!searchTerm) {
    showError('Please enter a search term to find the event');
    return;
  }
  
  await findEventForMatch(matchName, searchTerm);
}

/**
 * Find event for a specific match
 * @param {string} matchName - Name of the match
 * @param {string} searchTerm - Optional search term to override config
 */
async function findEventForMatch(matchName, searchTerm = null) {
  try {
    const response = await fetch(API.FIND_EVENT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        matchName,
        searchTerm 
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      showMessage(`Found event URL: ${result.url}`);
      // Refresh after a short delay to see the update
      setTimeout(fetchStatus, 1000);
    } else {
      showError(result.message || 'No events found matching the search term');
    }
  } catch (error) {
    console.error('Error finding event:', error);
    showError(`Failed to find event: ${error.message}`);
  }
}

/**
 * Run the bot immediately for a specific match
 * @param {string} matchName - Name of the match to run
 */
async function runBotNow(matchName) {
  try {
    const response = await fetch(API.RUN_NOW, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ matchName })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    showMessage(`Bot started for ${matchName}`);
    
    // Refresh after a short delay
    setTimeout(fetchStatus, 2000);
  } catch (error) {
    console.error('Error running bot:', error);
    showError(`Failed to start bot for ${matchName}`);
  }
}

/**
 * Format a date string
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Format uptime in seconds to a human-readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
  if (!seconds) return '0 seconds';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
}

/**
 * Show a success message to the user
 * @param {string} message - Message to display
 */
function showMessage(message) {
  // Here you would show a toast or some other notification
  // For simplicity, we'll just use an alert
  alert(message);
}

/**
 * Show an error message to the user
 * @param {string} message - Error message to display
 */
function showError(message) {
  // Here you would show a toast or some other notification
  // For simplicity, we'll just use an alert
  alert(`Error: ${message}`);
} 