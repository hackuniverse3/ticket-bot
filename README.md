# Football Ticket Bot

An automated bot for purchasing football tickets as soon as they become available on a specific website.

## Features

- Monitors a ticket website for ticket availability
- Automatically logs in to your webook.com account
- Automatically purchases tickets when they become available
- Supports customization for different matches
- Can handle both block seating and individual seat selection
- Configurable to ensure adjacent seating
- Web interface for monitoring and configuration
- Scheduled 24/7 operation

## Prerequisites

- Node.js 16+
- npm or yarn

## Installation

1. Clone this repository:
```
git clone <repository-url>
cd football-ticket-bot
```

2. Install dependencies:
```
npm install
```

3. Create a `.env` file in the root directory (use the `.env.example` as a template) and fill in your configuration:
```
# Base URL for the ticket website
WEBSITE_URL=https://webook.com

# Login information
LOGIN_EMAIL=your_email@example.com
LOGIN_PASSWORD=your_password

# Payment information
CARD_NUMBER=your_card_number
EXPIRY_DATE=MM/YY
CVV=123
FIRST_NAME=Your
LAST_NAME=Name
EMAIL=your@email.com

# Bot settings
REFRESH_INTERVAL=60000
HEADLESS=true
SLOW_MO=50

# Server settings
PORT=3000
HOST=0.0.0.0

# Logging
LOG_LEVEL=info
```

## Configuration

The bot is configured using a combination of environment variables and the `config/default.json` file. You can also modify the configuration through the web interface.

### Match Configuration

In `config/default.json`, you can configure the matches you want to monitor:

```json
{
  "tickets": {
    "matches": [
      {
        "name": "Real Madrid vs Barcelona",
        "url": "/real-madrid",
        "team": "Real Madrid",
        "preferredSeats": {
          "section": "G10",
          "quantity": 5,
          "adjacentSeats": true
        },
        "alternative": {
          "section": "H7",
          "quantity": 5,
          "adjacentSeats": true
        }
      }
    ]
  }
}
```

### Login Configuration

Make sure to configure your webook.com login credentials in the `.env` file or in the `config/default.json` file:

```json
{
  "loginInfo": {
    "email": "your_email@example.com",
    "password": "your_password"
  }
}
```

## Running the Bot

### Development Mode

```
npm run dev
```

### Production Mode

```
npm start
```

## Deploying to fly.io

1. Install the Fly CLI:
```
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly:
```
fly auth login
```

3. Create a new app:
```
fly launch
```

4. Set environment secrets (replace with your actual values):
```
fly secrets set LOGIN_EMAIL=your_email@example.com
fly secrets set LOGIN_PASSWORD=your_password
fly secrets set CARD_NUMBER=1234567890123456
fly secrets set EXPIRY_DATE=12/24
fly secrets set CVV=123
fly secrets set FIRST_NAME=Your
fly secrets set LAST_NAME=Name
fly secrets set EMAIL=your@email.com
```

5. Deploy the app:
```
fly deploy
```

## Web Interface

The bot includes a web interface for monitoring and configuration, available at:

```
http://localhost:3000
```

## How It Works

1. The bot logs in to your webook.com account using your credentials
2. It navigates to the configured match URL (or searches for it first)
3. It clicks on "Public Tickets"
4. It selects the specified team
5. Depending on the stadium type, it:
   - Selects blocks of seats
   - Or selects individual seats (preferring adjacent seats if configured)
6. It proceeds to checkout and completes the purchase with the configured payment details

## License

MIT 