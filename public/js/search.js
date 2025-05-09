// API endpoints
const API = {
  DIRECT_SEARCH: '/api/search',
  SAVE_CONFIG: '/api/create-match'
};

// DOM elements
const searchForm = document.getElementById('search-form');
const searchTermInput = document.getElementById('search-term');
const searchStatusElement = document.getElementById('search-status');
const searchResultsContainer = document.getElementById('search-results');
const selectedEventCard = document.getElementById('selected-event-card');
const selectedEventDetails = document.getElementById('selected-event-details');
const eventConfigForm = document.getElementById('event-config-form');
const clearSelectionBtn = document.getElementById('clear-selection-btn');

// Currently selected event
let selectedEvent = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  searchForm.addEventListener('submit', handleSearch);
  eventConfigForm.addEventListener('submit', saveEventConfiguration);
  clearSelectionBtn.addEventListener('click', clearEventSelection);
  
  // Focus the search input on page load
  searchTermInput.focus();
});

/**
 * Handle search form submission
 * @param {Event} event - Form submit event
 */
async function handleSearch(event) {
  event.preventDefault();
  
  const searchTerm = searchTermInput.value.trim();
  
  if (!searchTerm) {
    showError('Please enter a search term');
    return;
  }
  
  // Show search status
  showSearchStatus('Searching for events matching "' + searchTerm + '"...');
  
  try {
    const events = await searchEvents(searchTerm);
    displaySearchResults(events);
  } catch (error) {
    console.error('Search error:', error);
    showError(`Search failed: ${error.message}`);
  } finally {
    hideSearchStatus();
  }
}

/**
 * Search for events using the API
 * @param {string} searchTerm - The term to search for
 * @returns {Promise<Array>} Array of event objects
 */
async function searchEvents(searchTerm) {
  const response = await fetch(API.DIRECT_SEARCH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ searchTerm })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || 'Search failed');
  }
  
  return result.events || [];
}

/**
 * Display search results in the UI
 * @param {Array} events - Array of event objects
 */
function displaySearchResults(events) {
  searchResultsContainer.innerHTML = '';
  
  if (events.length === 0) {
    searchResultsContainer.innerHTML = `
      <div class="alert alert-warning">
        No events found. Try using different search terms.
      </div>
    `;
    return;
  }
  
  // Create results header
  const resultsHeader = document.createElement('h6');
  resultsHeader.textContent = `Found ${events.length} events:`;
  searchResultsContainer.appendChild(resultsHeader);
  
  // Create results list
  const resultsList = document.createElement('div');
  resultsList.className = 'list-group mt-2';
  
  events.forEach(event => {
    const resultItem = document.createElement('a');
    resultItem.href = '#';
    resultItem.className = 'list-group-item list-group-item-action';
    resultItem.dataset.eventUrl = event.url;
    
    // Create result content
    const teamsText = event.teams && event.teams.length > 0 
      ? `<div class="small text-primary">${event.teams.join(' vs ')}</div>` 
      : '';
    
    const dateText = event.date 
      ? `<div class="small text-muted">${event.date}</div>` 
      : '';
    
    const locationText = event.location 
      ? `<div class="small"><i class="bi bi-geo-alt"></i> ${event.location}</div>` 
      : '';
    
    const imageHtml = event.imageUrl 
      ? `<img src="${event.imageUrl}" alt="${event.title}" class="float-end rounded ms-2" style="max-width: 80px; max-height: 60px;">` 
      : '';
    
    resultItem.innerHTML = `
      ${imageHtml}
      <div class="d-flex w-100 justify-content-between">
        <h6 class="mb-1">${event.title}</h6>
      </div>
      ${teamsText}
      ${dateText}
      ${locationText}
    `;
    
    // Add event listener
    resultItem.addEventListener('click', (e) => {
      e.preventDefault();
      selectEvent(event);
    });
    
    resultsList.appendChild(resultItem);
  });
  
  searchResultsContainer.appendChild(resultsList);
}

/**
 * Select an event and display its details
 * @param {Object} event - Event object
 */
function selectEvent(event) {
  // Store the selected event
  selectedEvent = event;
  
  // Show the selected event card
  selectedEventCard.classList.remove('d-none');
  
  // Scroll to the event card
  selectedEventCard.scrollIntoView({ behavior: 'smooth' });
  
  // Display event details
  const teamsText = event.teams && event.teams.length > 0 
    ? `<p><strong>Teams:</strong> ${event.teams.join(' vs ')}</p>` 
    : '';
  
  const dateText = event.date 
    ? `<p><strong>Date:</strong> ${event.date}</p>` 
    : '';
  
  const locationText = event.location 
    ? `<p><strong>Location:</strong> ${event.location}</p>` 
    : '';
  
  const urlText = `<p><strong>Event URL:</strong> <a href="${event.url}" target="_blank">${event.url}</a></p>`;
  
  const imageHtml = event.imageUrl 
    ? `<img src="${event.imageUrl}" alt="${event.title}" class="img-thumbnail mb-3" style="max-width: 200px;">` 
    : '';
  
  selectedEventDetails.innerHTML = `
    <h4>${event.title}</h4>
    ${imageHtml}
    ${teamsText}
    ${dateText}
    ${locationText}
    ${urlText}
  `;
  
  // Pre-fill the configuration form
  document.getElementById('event-url').value = event.url;
  document.getElementById('event-title').value = event.title;
  document.getElementById('match-name').value = event.title;
  
  // If teams are available, suggest the first team
  if (event.teams && event.teams.length > 0) {
    document.getElementById('team-name').value = event.teams[0];
  }
}

/**
 * Clear the selected event
 */
function clearEventSelection() {
  selectedEvent = null;
  selectedEventCard.classList.add('d-none');
  selectedEventDetails.innerHTML = '';
  eventConfigForm.reset();
}

/**
 * Save the event configuration
 * @param {Event} event - Form submit event
 */
async function saveEventConfiguration(event) {
  event.preventDefault();
  
  if (!selectedEvent) {
    showError('No event selected');
    return;
  }
  
  // Get form data
  const formData = new FormData(eventConfigForm);
  const config = {
    name: formData.get('matchName'),
    url: formData.get('eventUrl'),
    team: formData.get('team'),
    preferredSeats: {
      section: formData.get('preferredSeats.section'),
      quantity: parseInt(formData.get('preferredSeats.quantity')),
      adjacentSeats: formData.get('preferredSeats.adjacentSeats') === 'on'
    },
    alternative: {
      section: formData.get('alternative.section'),
      quantity: parseInt(formData.get('alternative.quantity')),
      adjacentSeats: formData.get('alternative.adjacentSeats') === 'on'
    },
    searchTerm: searchTermInput.value.trim()
  };
  
  try {
    const response = await fetch(API.SAVE_CONFIG, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      showMessage('Configuration saved successfully');
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } else {
      throw new Error(result.message || 'Failed to save configuration');
    }
  } catch (error) {
    console.error('Save error:', error);
    showError(`Failed to save configuration: ${error.message}`);
  }
}

/**
 * Show search status message
 * @param {string} message - Status message to display
 */
function showSearchStatus(message) {
  searchStatusElement.textContent = message;
  searchStatusElement.classList.remove('d-none');
  // Clear previous results while searching
  searchResultsContainer.innerHTML = '';
}

/**
 * Hide search status message
 */
function hideSearchStatus() {
  searchStatusElement.classList.add('d-none');
}

/**
 * Show a success message to the user
 * @param {string} message - Message to display
 */
function showMessage(message) {
  alert(message);
}

/**
 * Show an error message to the user
 * @param {string} message - Error message to display
 */
function showError(message) {
  alert(`Error: ${message}`);
} 