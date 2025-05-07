# Webook Ticket Bot

An automated ticket purchasing bot for webook.com. This bot monitors for ticket availability and instantly purchases tickets when they become available.

## Features

- Automatically monitors ticket website for availability
- Purchases tickets as soon as they become available
- Configurable for different matches/events
- Uses direct HTTP requests for maximum speed and reliability
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
3. Create a `.env` file with your settings or use the web interface to configure

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

## How It Works

The bot uses two approaches to check for ticket availability:

1. **API-based checking**: Attempts to check availability via the website's API (faster)
2. **HTTP-based checking**: Scrapes the event page with Cheerio to detect ticket availability (more reliable)

When tickets are found, the bot automatically:
1. Loads the event page
2. Extracts form tokens and ticket information
3. Logs in with your credentials (if needed)
4. Selects the specified ticket category and quantity
5. Completes the checkout process

## Troubleshooting

- If the bot can't find tickets, try adjusting the selectors in `ticketService.js`
- Make sure your credentials are correct in the .env file or web interface
- Check the logs for detailed error information

## License

MIT 