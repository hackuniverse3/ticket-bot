# Football Ticket Bot

An automated bot for purchasing football match tickets from webook.com as soon as they become available.

## Features

- Monitors ticket website continuously and purchases tickets when they are released
- Supports customization of target matches
- Provides API endpoints to control and monitor the bot
- Runs 24/7 with automatic error recovery
- Designed for deployment on fly.io

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker (for containerization)
- fly.io account and CLI (for deployment)

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   # Website credentials
   WEBSITE_USERNAME=your_username
   WEBSITE_PASSWORD=your_password
   
   # Website URL
   WEBSITE_URL=https://webook.com
   
   # Server configuration
   PORT=3000
   
   # Logging configuration
   LOG_LEVEL=info
   ```
4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Start Monitoring

```
POST /api/monitor
```

Request body:
```json
{
  "name": "Real Madrid vs Barcelona",
  "date": "2023-05-20",
  "quantity": 2
}
```

Response:
```json
{
  "success": true,
  "taskId": "ticket-monitor-1620000000000",
  "message": "Started monitoring for Real Madrid vs Barcelona on 2023-05-20 for 2 tickets"
}
```

### Check Status

```
GET /api/status
```

Response:
```json
{
  "tasks": [
    {
      "id": "ticket-monitor-1620000000000",
      "match": "Real Madrid vs Barcelona",
      "date": "2023-05-20",
      "quantity": 2,
      "purchased": false
    }
  ],
  "isPurchased": false
}
```

### Stop Monitoring

```
DELETE /api/monitor/:taskId
```

Response:
```json
{
  "success": true,
  "message": "Stopped monitoring task ticket-monitor-1620000000000"
}
```

## Deploying to fly.io

1. Install the [fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Login to fly.io:
   ```
   fly auth login
   ```
3. Create a fly.io app:
   ```
   fly apps create football-ticket-bot
   ```
4. Set secrets for your environment variables:
   ```
   fly secrets set WEBSITE_USERNAME=your_username WEBSITE_PASSWORD=your_password
   ```
5. Deploy the app:
   ```
   fly deploy
   ```

## Customizing

To customize the bot for different matches:

1. Use the API endpoint to set different match targets
2. Update the website selectors in `src/services/ticketService.js` if necessary

## License

MIT 