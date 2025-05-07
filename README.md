# WeBook Ticket Bot

An automated ticket purchasing bot for WeBook.com that monitors and purchases tickets as soon as they become available.

## Features

- Fast ticket monitoring and purchasing
- Dual-mode operation (API-first with Playwright fallback)
- Configurable ticket preferences
- Automatic login and session management
- Real-time monitoring and notifications

## Setup

1. Install Python 3.8 or higher
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install Playwright browsers:
   ```bash
   playwright install
   ```
4. Create a `.env` file in the project root with your WeBook credentials:
   ```
   WEBBOOK_EMAIL=your_email@example.com
   WEBBOOK_PASSWORD=your_password
   ```

## Configuration

Edit `config.json` to customize:
- Monitoring interval
- Maximum attempts
- Ticket preferences (quantity, section, price range)
- Notification settings

## Usage

Run the bot:
```bash
python ticket_bot.py
```

The bot will:
1. Log in to your WeBook account
2. Monitor the specified event for ticket availability
3. Automatically purchase tickets when they become available
4. Provide real-time status updates in the console

## Notes

- The bot first attempts to use the WeBook API for faster operation
- If API access fails, it automatically falls back to using Playwright
- All operations are logged for debugging purposes
- The bot runs in headless mode by default for better performance

## Security

- Never share your `.env` file or credentials
- The bot stores credentials only in the `.env` file
- All sensitive data is handled securely

## Troubleshooting

If you encounter issues:
1. Check your internet connection
2. Verify your WeBook credentials
3. Ensure all dependencies are installed
4. Check the console logs for error messages 