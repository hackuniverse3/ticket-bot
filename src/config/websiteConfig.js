/**
 * Website-specific configuration
 * This file contains selectors and other website-specific configurations
 * If the website structure changes, users should update these values
 */

module.exports = {
  selectors: {
    // Login-related selectors
    login: {
      button: '.login-button',
      usernameField: '#username',
      passwordField: '#password',
      submitButton: '#login-submit',
      userProfileIndicator: '.user-profile'
    },
    
    // Search-related selectors
    search: {
      input: '#search-input',
      button: '#search-button',
      results: '.match-results',
      matchItem: '.match-item'
    },
    
    // Ticket-related selectors
    tickets: {
      availabilityIndicator: '.ticket-availability',
      quantityDropdown: '#quantity-dropdown',
      buyButton: '#buy-tickets-button',
      confirmPurchaseButton: '#confirm-purchase',
      purchaseConfirmation: '.purchase-confirmation'
    }
  },
  
  // Text patterns to identify sold out or unavailable tickets
  unavailabilityPatterns: [
    'Sold Out', 
    'Not Available', 
    'Coming Soon'
  ],
  
  // URL paths
  paths: {
    matches: '/matches',
    checkout: '/checkout'
  }
}; 