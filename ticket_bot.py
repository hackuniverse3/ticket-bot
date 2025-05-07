import os
import json
import time
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import aiohttp
from playwright.async_api import async_playwright
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WeBookTicketBot:
    def __init__(self):
        load_dotenv()
        self.base_url = "https://webook.com"
        self.api_url = "https://api.webook.com"  # This is a placeholder, we'll need to find the actual API endpoint
        self.session = None
        self.use_api = True  # Flag to switch between API and Playwright
        
    async def initialize(self):
        """Initialize the bot and create necessary sessions"""
        if self.use_api:
            self.session = aiohttp.ClientSession()
        else:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context()
            self.page = await self.context.new_page()

    async def login(self, email: str, password: str) -> bool:
        """Login to WeBook"""
        try:
            if self.use_api:
                # Try API login first
                login_url = f"{self.api_url}/auth/login"  # Placeholder URL
                data = {
                    "email": email,
                    "password": password
                }
                async with self.session.post(login_url, json=data) as response:
                    if response.status == 200:
                        return True
                    logger.error(f"API login failed: {response.status}")
                    self.use_api = False  # Fallback to Playwright if API fails
                    return await self.login(email, password)
            else:
                # Playwright login
                await self.page.goto(f"{self.base_url}/en/login")
                await self.page.fill('input[type="email"]', email)
                await self.page.fill('input[type="password"]', password)
                await self.page.click('button[type="submit"]')
                await self.page.wait_for_load_state('networkidle')
                return True
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return False

    async def monitor_tickets(self, event_url: str, max_attempts: int = 100):
        """Monitor ticket availability for a specific event"""
        logger.info(f"Starting to monitor tickets for: {event_url}")
        attempts = 0
        
        while attempts < max_attempts:
            try:
                if self.use_api:
                    # Try to get ticket availability through API
                    event_id = event_url.split('/')[-1]
                    api_url = f"{self.api_url}/events/{event_id}/tickets"  # Placeholder URL
                    async with self.session.get(api_url) as response:
                        if response.status == 200:
                            data = await response.json()
                            if self._check_ticket_availability(data):
                                return await self.purchase_tickets(event_url)
                else:
                    # Use Playwright to check availability
                    await self.page.goto(event_url)
                    await self.page.wait_for_load_state('networkidle')
                    
                    # Check for available tickets (this selector needs to be updated based on actual website)
                    available = await self.page.query_selector('.ticket-available')
                    if available:
                        return await self.purchase_tickets(event_url)

                attempts += 1
                await asyncio.sleep(1)  # Wait 1 second before next check
                
            except Exception as e:
                logger.error(f"Error monitoring tickets: {str(e)}")
                attempts += 1
                await asyncio.sleep(1)

        logger.error("Max attempts reached without finding available tickets")
        return False

    async def purchase_tickets(self, event_url: str) -> bool:
        """Purchase tickets when available"""
        try:
            if self.use_api:
                # API purchase flow
                event_id = event_url.split('/')[-1]
                purchase_url = f"{self.api_url}/events/{event_id}/purchase"  # Placeholder URL
                data = {
                    "quantity": 1,
                    "section": "best_available"  # This should be configurable
                }
                async with self.session.post(purchase_url, json=data) as response:
                    if response.status == 200:
                        logger.info("Successfully purchased tickets!")
                        return True
            else:
                # Playwright purchase flow
                await self.page.goto(event_url)
                await self.page.wait_for_load_state('networkidle')
                
                # Click on the first available ticket
                await self.page.click('.ticket-available')
                await self.page.wait_for_load_state('networkidle')
                
                # Proceed to checkout
                await self.page.click('.checkout-button')
                await self.page.wait_for_load_state('networkidle')
                
                # Confirm purchase
                await self.page.click('.confirm-purchase')
                await self.page.wait_for_load_state('networkidle')
                
                logger.info("Successfully purchased tickets!")
                return True
                
        except Exception as e:
            logger.error(f"Error purchasing tickets: {str(e)}")
            return False

    def _check_ticket_availability(self, data: Dict[str, Any]) -> bool:
        """Check if tickets are available in the API response"""
        # This method needs to be implemented based on the actual API response structure
        return True  # Placeholder

    async def close(self):
        """Clean up resources"""
        if self.session:
            await self.session.close()
        if not self.use_api:
            await self.browser.close()
            await self.playwright.stop()

async def main():
    # Load credentials from environment variables
    email = os.getenv('WEBBOOK_EMAIL')
    password = os.getenv('WEBBOOK_PASSWORD')
    
    if not email or not password:
        logger.error("Please set WEBBOOK_EMAIL and WEBBOOK_PASSWORD environment variables")
        return

    bot = WeBookTicketBot()
    await bot.initialize()
    
    try:
        if await bot.login(email, password):
            # Test with the provided match URL
            event_url = "https://webook.com/en/events/spl-alnassr-vs-alittihad-469422"
            await bot.monitor_tickets(event_url)
    finally:
        await bot.close()

if __name__ == "__main__":
    asyncio.run(main()) 