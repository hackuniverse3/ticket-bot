# Football Ticket Bot User Guide

This guide will help you customize the ticket bot for different websites and match scenarios. The bot is designed to be easily adaptable to different football ticket websites.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Customizing for a Different Website](#customizing-for-a-different-website)
3. [Setting Up Match Monitoring](#setting-up-match-monitoring)
4. [Running the Bot 24/7](#running-the-bot-247)
5. [Troubleshooting](#troubleshooting)

## Initial Setup

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file with the following variables:
   ```
   WEBSITE_USERNAME=your_username
   WEBSITE_PASSWORD=your_password
   WEBSITE_URL=https://webook.com
   PORT=3000
   LOG_LEVEL=info
   CHECK_INTERVAL=*/30 * * * * *
   ```

3. **Run the test script** to ensure everything is set up correctly:
   ```
   npm run test
   ```

## Customizing for a Different Website

The bot is designed to work with webook.com by default, but you can easily adapt it to work with other ticket websites by modifying the website configuration.

### Step 1: Understand the Website Structure

Before customizing, you need to understand the structure of the target website:
- How does the login process work?
- Where are the match listings located?
- How can you tell if tickets are available?
- What's the purchase flow like?

### Step 2: Update Website Configuration

Edit the `src/config/websiteConfig.js` file to match the target website's structure:

```javascript
module.exports = {
  selectors: {
    // Login-related selectors
    login: {
      button: '.your-login-button-selector',
      usernameField: '#your-username-field-selector',
      passwordField: '#your-password-field-selector',
      submitButton: '#your-login-submit-button-selector',
      userProfileIndicator: '.logged-in-indicator-selector'
    },
    
    // Search-related selectors
    search: {
      input: '#your-search-input-selector',
      button: '#your-search-button-selector',
      results: '.your-search-results-selector',
      matchItem: '.your-match-item-selector'
    },
    
    // Ticket-related selectors
    tickets: {
      availabilityIndicator: '.your-availability-indicator-selector',
      quantityDropdown: '#your-quantity-dropdown-selector',
      buyButton: '#your-buy-button-selector',
      confirmPurchaseButton: '#your-confirm-button-selector',
      purchaseConfirmation: '.your-purchase-confirmation-selector'
    }
  },
  
  // Text patterns that indicate tickets are not available
  unavailabilityPatterns: [
    'Sold Out', 
    'Not Available'
    // Add any other patterns used by the target website
  ],
  
  // URL paths
  paths: {
    matches: '/your-matches-path',
    checkout: '/your-checkout-path'
  }
};
```

### Step 3: Test Your Configuration

After updating the configuration, run the test script to check if your selectors work:

```
npm run test
```

## Setting Up Match Monitoring

### Using the API

The bot provides a simple REST API to control the monitoring process:

1. **Start monitoring for a match**:
   ```
   POST /api/monitor
   
   {
     "name": "Real Madrid vs Barcelona",
     "date": "2023-12-25",
     "quantity": 2
   }
   ```

2. **Check monitoring status**:
   ```
   GET /api/status
   ```

3. **Stop monitoring**:
   ```
   DELETE /api/monitor/:taskId
   ```

### Using the Sample Script

You can also use the provided sample script:

```
npm run sample
```

This will demonstrate how to programmatically interact with the bot's API.

## Running the Bot 24/7

### Local Deployment

For local testing, you can run:

```
npm start
```

Use a process manager like PM2 for persistent operation:

```
npm install -g pm2
pm2 start src/index.js --name ticket-bot
```

### Deploying to fly.io

To deploy to fly.io and run the bot 24/7:

1. Install the fly.io CLI:
   ```
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to fly.io:
   ```
   fly auth login
   ```

3. Create a fly.io app:
   ```
   fly apps create football-ticket-bot
   ```

4. Set environment variables:
   ```
   fly secrets set WEBSITE_USERNAME=your_username WEBSITE_PASSWORD=your_password
   ```

5. Deploy the app:
   ```
   fly deploy
   ```

Alternatively, use the provided deploy script:
```
bash deploy.sh
```

## Troubleshooting

### Common Issues

1. **Login fails**: Check if the login selectors are correct and that your credentials are valid.

2. **Match not found**: Verify that the search selectors are correct and that the match exists.

3. **Browser initialization fails**: Make sure you have the necessary dependencies for Puppeteer.

4. **Bot crashes during operation**: Check the logs for error messages. Increase the timeout values if needed.

### Logs

Check the logs directory for detailed information about bot operations:
- `logs/combined.log`: All log messages
- `logs/error.log`: Error messages only

### Getting Help

If you encounter issues:
1. Check the logs for error messages
2. Update Puppeteer and other dependencies
3. Verify that your selectors match the website structure
4. Try running in non-headless mode for debugging by modifying `src/services/browser.js`