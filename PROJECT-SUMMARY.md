# Football Ticket Bot - Project Summary

## Overview

This project is an automated bot designed to purchase football match tickets from webook.com as soon as they become available. The bot runs 24/7, continuously monitoring the website and automatically purchasing tickets when they are released.

## Key Features

1. **Automated Ticket Monitoring**: Continuously checks for ticket availability for specified matches
2. **Instant Purchase**: Completes the purchase immediately when tickets become available
3. **Customizable**: Supports different matches, dates, and ticket quantities
4. **Web Interface**: User-friendly interface to control the bot
5. **API Access**: RESTful API for programmatic control
6. **Error Recovery**: Automatic restart and recovery from failures
7. **Logging**: Detailed logs for troubleshooting
8. **Deployment Ready**: Configured for deployment to fly.io

## Project Structure

```
football-ticket-bot/
├── src/
│   ├── config/           # Configuration files
│   │   ├── config.js     # Application configuration
│   │   └── websiteConfig.js  # Website-specific selectors
│   ├── services/         # Core services
│   │   ├── browser.js    # Browser automation service
│   │   ├── scheduler.js  # Task scheduling service
│   │   └── ticketService.js  # Ticket purchasing service
│   ├── utils/            # Utility functions
│   │   └── logger.js     # Logging utility
│   ├── public/           # Web interface
│   │   └── index.html    # User interface
│   └── index.js          # Main application entry point
├── Dockerfile            # Docker configuration
├── fly.toml              # Fly.io configuration
├── package.json          # Node.js dependencies
├── README.md             # Project documentation
├── GUIDE.md              # Detailed user guide
├── .gitignore            # Git ignore rules
├── deploy.sh             # Deployment script
├── sample-usage.js       # API usage example
└── test.js               # Basic test script
```

## Technologies Used

- **Node.js**: Runtime environment
- **Puppeteer**: Web browser automation
- **Express**: Web server and API
- **Node-cron**: Task scheduling
- **Winston**: Logging
- **Fly.io**: Deployment platform

## How It Works

1. **Initialization**: The bot launches a headless browser instance
2. **Authentication**: Logs into the ticket website using provided credentials
3. **Monitoring**: Periodically checks for the specified match
4. **Availability Check**: Determines if tickets are available
5. **Purchase**: Automatically selects quantity and completes the purchase
6. **Notification**: Logs the successful purchase and takes a screenshot

## Usage

### Web Interface

The bot includes a user-friendly web interface accessible at `http://localhost:3000` when running locally. This interface allows you to:

- Set target matches
- Start and stop monitoring
- Check monitoring status

### API Usage

The bot provides a RESTful API for programmatic control:

- `POST /api/monitor`: Start monitoring for a match
- `GET /api/status`: Check monitoring status
- `DELETE /api/monitor/:taskId`: Stop monitoring

## Customization

The bot is designed to be easily adapted to different websites by updating the selectors in `src/config/websiteConfig.js`. This allows the system to work with various ticket platforms without modifying the core functionality.

## Deployment

The project includes all necessary configuration for deployment to fly.io, a platform that allows 24/7 operation. The included deploy script simplifies the deployment process.

## Next Steps

1. **Website-Specific Customization**: Update selectors in websiteConfig.js to match webook.com's actual structure
2. **Testing**: Run the test script to verify configuration
3. **Deployment**: Deploy to fly.io for 24/7 operation 