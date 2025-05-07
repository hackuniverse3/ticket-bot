# WeBook Ticket Bot

An automated ticket purchasing bot for WeBook.com that monitors and purchases football match tickets as soon as they become available. Designed for maximum speed and reliability.

## Features

- **Ultra-Fast Ticket Monitoring**: Automatically refreshes and checks for ticket availability with configurable intervals
- **Dual-Mode Operation**: Uses direct API calls when possible, with a fallback to Playwright browser automation
- **Smart Detection**: Automatically discovers API endpoints and authentication methods for optimal performance
- **Flexible Configuration**: Easily customize ticket preferences, monitoring settings, and purchase behavior
- **Auto-Login**: Handles authentication and maintains session state
- **Purchase Confirmation**: Saves screenshots of successful purchases as proof
- **Comprehensive Logging**: Detailed logs for troubleshooting and monitoring

## Installation

1. Install Python 3.8 or higher
2. Clone this repository
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install Playwright browsers:
   ```bash
   playwright install
   ```
5. Copy `env.example` to `.env` and add your WeBook credentials:
   ```
   WEBBOOK_EMAIL=your_email@example.com
   WEBBOOK_PASSWORD=your_password
   ```

## Configuration

The bot is highly configurable through the `config.json` file:

### Basic Settings
- `monitoring_interval`: How often to check for tickets (in seconds)
- `max_attempts`: Maximum number of attempts before giving up

### Ticket Preferences
- Set quantity, preferred sections, and price range
- Configure seating preferences (sections, rows)

### Events
- Target specific events by URL
- Set priorities for multiple events

### Purchase Settings
- Enable/disable automatic purchasing
- Configure retry behavior and timeouts

### Browser Settings
- Customize the browser environment for optimal performance

## Usage

To start monitoring and purchasing tickets:

```bash
python ticket_bot.py
```

The bot will:
1. Initialize and discover API endpoints
2. Log into your WeBook account
3. Monitor the target event URL for ticket availability
4. Automatically purchase tickets when available
5. Save confirmation screenshots and logs

### Customizing Event Targets

Edit the `event_targets` section in `config.json` to monitor different events:

```json
"event_targets": [
    {
        "name": "Real Madrid vs Barcelona",
        "url": "https://webook.com/en/events/your-event-id",
        "priority": "high"
    }
]
```

## How It Works

1. **Initialization**: The bot first tries to discover the actual API endpoints used by the website by analyzing network traffic.

2. **Authentication**: Attempts to authenticate via API first, then falls back to browser login if needed.

3. **Ticket Monitoring**: Continuously checks for ticket availability using the fastest available method.

4. **Purchase Process**: When tickets become available, the bot automatically:
   - Selects the configured number of tickets
   - Chooses the best available seats based on preferences
   - Proceeds through the checkout process
   - Captures confirmation for verification

## Advanced Usage

### Headless Mode

By default, the bot runs in headless mode (no visible browser). To see the browser in action:

1. Set `HEADLESS=false` in your `.env` file
2. Restart the bot

### Multiple Event Monitoring

To monitor multiple events simultaneously, add them to the `event_targets` array in `config.json`.

## Troubleshooting

If you encounter issues:

- Check `bot.log` for detailed error messages and status updates
- Verify your WeBook credentials in the `.env` file
- Make sure you have proper internet connectivity
- Try setting `HEADLESS=false` to see what's happening in the browser

## Security Notes

- Your credentials are stored locally in the `.env` file
- The bot uses standard headers and user agents to mimic normal browser behavior
- Screenshots are saved locally and contain potentially sensitive information

## Disclaimer

This tool is for educational purposes only. Use responsibly and in accordance with WeBook's terms of service. 