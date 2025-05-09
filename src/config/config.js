require('dotenv').config();

module.exports = {
  website: {
    url: process.env.WEBSITE_URL || 'https://webook.com',
    username: process.env.WEBSITE_USERNAME,
    password: process.env.WEBSITE_PASSWORD,
  },
  server: {
    port: process.env.PORT || 3000,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  scheduler: {
    // Check for tickets every 30 seconds by default
    checkInterval: process.env.CHECK_INTERVAL || '*/30 * * * * *',
  }
}; 