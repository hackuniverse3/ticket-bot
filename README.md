# Webook Ticket Bot

An automated ticket purchasing bot for webook.com. This bot monitors for ticket availability and instantly purchases tickets when they become available.

## Features

- Automatically monitors ticket website for availability
- Purchases tickets as soon as they become available
- Configurable for different matches/events
- Supports both API-based and browser-based ticket purchasing
- Web interface for monitoring status and configuration

## Requirements

- Node.js 18 or higher
- A webook.com account

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Install Playwright browser:
   ```
   npx playwright install chromium
   ```
4. Create a `.env` file with your settings or use the web interface to configure

## Usage

Start the bot:

```
npm start
```

For development with auto-restart:

```
npm run dev
```

## Web Interface

Once the bot is running, you can access the web interface at:

```
http://localhost:3000
```

The web interface allows you to:

1. **Configure the bot** - Set your webook.com credentials, target event URL, and purchase options
2. **Monitor status** - See real-time status of the bot, including last check time and results
3. **Control operation** - Start and stop the ticket monitoring process

## Configuration Options

- **Webook Email/Password** - Your login credentials for webook.com
- **Target Event URL** - The URL of the specific match you want tickets for
- **Number of Tickets** - How many tickets to purchase when available
- **Monitor Interval** - How frequently to check for tickets (in seconds)
- **Ticket Category** - Specific category of tickets to purchase (leave as "General" if unsure)

## Deployment

This project includes configuration for deployment on fly.io:

```
fly launch
fly deploy
```

## Testing

You can test the bot with the following match:
```
https://webook.com/en/events/spl-alnassr-vs-alittihad-469422
```

## Troubleshooting

- If the bot can't find tickets, try adjusting the selectors in `ticketService.js`
- For browser-based issues, set `headless: false` in `purchaseTicketsViaBrowser()` to see what's happening
- Check the logs for detailed error information

## License

MIT 