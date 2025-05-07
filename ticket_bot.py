import os
import json
import time
import asyncio
import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
import aiohttp
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from dotenv import load_dotenv
from bs4 import BeautifulSoup

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class WeBookTicketBot:
    def __init__(self, config_path: str = "config.json"):
        load_dotenv()
        
        # Load configuration
        with open(config_path, "r") as f:
            self.config = json.load(f)
        
        self.base_url = "https://webook.com"
        self.api_url = "https://api.webook.com"  # Placeholder, will be determined during initialization
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://webook.com/en/",
            "Origin": "https://webook.com"
        }
        
        self.session = None
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.use_api = True  # Flag to switch between API and Playwright
        self.auth_token = None
        self.monitoring_interval = self.config.get("monitoring_interval", 1)
        self.max_attempts = self.config.get("max_attempts", 100)
        
    async def initialize(self):
        """Initialize the bot and create necessary sessions"""
        logger.info("Initializing bot...")
        
        # Initialize both API and Playwright for maximum flexibility
        self.session = aiohttp.ClientSession(headers=self.headers)
        
        # Start Playwright
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True if os.getenv('HEADLESS', 'true').lower() == 'true' else False,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        # Create a persistent context with more realistic browser settings
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            locale="en-US"
        )
        
        # Enable request interception to gather API endpoints and CSRF tokens
        await self.context.route("**/*", self._handle_route)
        
        # Create page and set default timeout
        self.page = await self.context.new_page()
        self.page.set_default_timeout(30000)  # 30 seconds
        
        # Visit the main page to discover API endpoints
        await self.page.goto(f"{self.base_url}/en")
        await self.page.wait_for_load_state("networkidle")
        
        logger.info("Bot initialized successfully")

    async def _handle_route(self, route, request):
        """Handle route for request interception"""
        # Allow the request to proceed
        await route.continue_()
        
        # Look for API endpoints in requests
        url = request.url
        if "api" in url and not url.endswith((".js", ".css", ".png", ".jpg", ".gif")):
            # Extract potential API base URL
            match = re.match(r"(https?://[^/]+/api)", url)
            if match and not self.api_url.startswith(match.group(1)):
                self.api_url = match.group(1)
                logger.info(f"Discovered API endpoint: {self.api_url}")
                
        # Look for authentication tokens
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            self.auth_token = auth_header.replace("Bearer ", "")
            logger.info("Captured authentication token")

    async def login(self, email: str, password: str) -> bool:
        """Login to WeBook"""
        logger.info("Attempting login...")
        try:
            # First attempt API login if we have the endpoint
            if self.use_api and self.api_url != "https://api.webook.com":
                login_data = {
                    "email": email,
                    "password": password
                }
                
                try:
                    login_url = f"{self.api_url}/auth/login"
                    logger.info(f"Attempting API login at {login_url}")
                    
                    async with self.session.post(login_url, json=login_data) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            # Check for auth token
                            token = data.get("token") or data.get("access_token")
                            if token:
                                self.auth_token = token
                                self.headers["Authorization"] = f"Bearer {token}"
                                self.session.headers.update(self.headers)
                                logger.info("API login successful")
                                return True
                        
                        logger.warning(f"API login failed with status {response.status}")
                except Exception as e:
                    logger.error(f"API login attempt failed: {str(e)}")
                
                # If we reach here, API login failed, fallback to Playwright
                self.use_api = False
            
            # Playwright login
            logger.info("Using Playwright for login")
            
            # Navigate to login page
            await self.page.goto(f"{self.base_url}/en/login")
            await self.page.wait_for_load_state("networkidle")
            
            # Fill login form
            # Look for email input field - try different selectors
            email_selectors = [
                'input[type="email"]', 
                'input[name="email"]',
                'input[placeholder*="Email"]'
            ]
            
            for selector in email_selectors:
                email_input = await self.page.query_selector(selector)
                if email_input:
                    await email_input.fill(email)
                    break
            else:
                logger.error("Could not find email input field")
                return False
                
            # Look for password input field
            password_selectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[placeholder*="Password"]'
            ]
            
            for selector in password_selectors:
                password_input = await self.page.query_selector(selector)
                if password_input:
                    await password_input.fill(password)
                    break
            else:
                logger.error("Could not find password input field")
                return False
                
            # Look for login button
            button_selectors = [
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign in")'
            ]
            
            for selector in button_selectors:
                if await self.page.query_selector(selector):
                    await self.page.click(selector)
                    break
            else:
                logger.error("Could not find login button")
                return False
                
            # Wait for navigation
            await self.page.wait_for_load_state("networkidle")
            
            # Check if login was successful by looking for indicators
            success_indicators = [
                'a:has-text("Account")',
                'a:has-text("Profile")',
                'a:has-text("My Account")',
                'a:has-text("Logout")'
            ]
            
            for indicator in success_indicators:
                if await self.page.query_selector(indicator):
                    logger.info("Playwright login successful")
                    return True
                    
            logger.error("Login appears to have failed")
            return False
            
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False

    async def extract_event_info(self, event_url: str) -> Dict[str, Any]:
        """Extract event information from the event page"""
        logger.info(f"Extracting event info for: {event_url}")
        
        try:
            # Visit the event page
            await self.page.goto(event_url)
            await self.page.wait_for_load_state("networkidle")
            
            # Get event ID from URL if possible
            event_id = event_url.split('/')[-1]
            
            # Try to extract structured data for event details
            event_data = await self.page.evaluate('''
                () => {
                    const ldJson = document.querySelector('script[type="application/ld+json"]');
                    if (ldJson) {
                        try {
                            return JSON.parse(ldJson.textContent);
                        } catch (e) {
                            return null;
                        }
                    }
                    return null;
                }
            ''')
            
            # Get HTML content
            content = await self.page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extract event name
            event_name = None
            title_element = soup.select_one('h1') or soup.select_one('.event-title')
            if title_element:
                event_name = title_element.get_text().strip()
            
            # Look for the "Book Now" or similar button to find booking path
            book_button = None
            for selector in [
                'a:has-text("Book Now")', 
                'button:has-text("Book")', 
                'a:has-text("Buy Tickets")',
                'a[href*="book"]'
            ]:
                if await self.page.query_selector(selector):
                    book_button = selector
                    break
            
            return {
                "event_id": event_id,
                "event_name": event_name,
                "book_button": book_button,
                "structured_data": event_data
            }
            
        except Exception as e:
            logger.error(f"Error extracting event info: {str(e)}")
            return {}

    async def monitor_tickets(self, event_url: str):
        """Monitor ticket availability for a specific event"""
        logger.info(f"Starting to monitor tickets for: {event_url}")
        
        # Extract event info first
        event_info = await self.extract_event_info(event_url)
        if not event_info:
            logger.error("Could not extract event information")
            return False
            
        logger.info(f"Monitoring tickets for event: {event_info.get('event_name', event_url)}")
        
        attempts = 0
        while attempts < self.max_attempts:
            try:
                available = False
                
                if self.use_api and self.api_url != "https://api.webook.com":
                    # API approach - check ticket availability
                    event_id = event_info.get("event_id")
                    api_url = f"{self.api_url}/events/{event_id}/tickets"
                    
                    headers = self.headers.copy()
                    if self.auth_token:
                        headers["Authorization"] = f"Bearer {self.auth_token}"
                    
                    try:
                        async with self.session.get(api_url, headers=headers) as response:
                            if response.status == 200:
                                data = await response.json()
                                available = self._check_ticket_availability(data)
                                
                                if available:
                                    logger.info("Tickets found available via API!")
                                    return await self.purchase_tickets(event_url, event_info)
                    except Exception as e:
                        logger.error(f"API check failed: {str(e)}")
                        self.use_api = False
                
                else:
                    # Playwright approach
                    await self.page.goto(event_url)
                    await self.page.wait_for_load_state("networkidle")
                    
                    # Look for ticket availability signals
                    availability_indicators = [
                        'button:has-text("Book Now"):not([disabled])',
                        'a:has-text("Book Now"):not([disabled])',
                        'button:has-text("Buy Tickets"):not([disabled])',
                        '.ticket-available',
                        '[data-status="available"]'
                    ]
                    
                    for indicator in availability_indicators:
                        if await self.page.query_selector(indicator):
                            logger.info(f"Tickets found available! (indicator: {indicator})")
                            available = True
                            break
                    
                    # If custom book button was found in event info, try that
                    if not available and event_info.get("book_button"):
                        if await self.page.query_selector(event_info["book_button"]):
                            logger.info("Tickets found available via custom book button!")
                            available = True
                    
                    if available:
                        return await self.purchase_tickets(event_url, event_info)
                
                # Check for sold out or unavailable indicators
                unavailable_indicators = [
                    'button:has-text("Sold Out")',
                    '.sold-out',
                    'text=Sold Out',
                    'text=Not Available'
                ]
                
                for indicator in unavailable_indicators:
                    if await self.page.query_selector(indicator):
                        logger.info(f"Tickets marked as sold out/unavailable ({indicator})")
                        # Don't abort completely, but log the situation
                
                attempts += 1
                logger.info(f"Attempt {attempts}/{self.max_attempts} - No tickets available yet")
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {str(e)}")
                attempts += 1
                await asyncio.sleep(self.monitoring_interval)
        
        logger.error("Max attempts reached without finding available tickets")
        return False

    def _check_ticket_availability(self, data: Dict[str, Any]) -> bool:
        """Check if tickets are available in the API response"""
        if not data:
            return False
            
        # Look for availability markers in the data
        if isinstance(data, dict):
            # Check if there's a direct availability flag
            if "available" in data:
                return data["available"] is True
                
            # Check for tickets array
            tickets = data.get("tickets") or data.get("data") or []
            if tickets and isinstance(tickets, list) and len(tickets) > 0:
                for ticket in tickets:
                    if isinstance(ticket, dict):
                        if ticket.get("available") is True or ticket.get("status") == "available":
                            return True
                            
            # Check for sections with availability
            sections = data.get("sections") or []
            if sections and isinstance(sections, list) and len(sections) > 0:
                for section in sections:
                    if isinstance(section, dict):
                        if section.get("available") is True or section.get("status") == "available":
                            return True
        
        return False

    async def purchase_tickets(self, event_url: str, event_info: Dict[str, Any]) -> bool:
        """Purchase tickets when available"""
        logger.info(f"Attempting to purchase tickets for {event_info.get('event_name', event_url)}")
        
        try:
            if self.use_api and self.api_url != "https://api.webook.com":
                # API purchase flow
                event_id = event_info.get("event_id")
                purchase_url = f"{self.api_url}/events/{event_id}/purchase"
                
                # Get ticket preferences from config
                ticket_preferences = self.config.get("ticket_preferences", {})
                quantity = ticket_preferences.get("quantity", 1)
                section = ticket_preferences.get("section", "best_available")
                
                purchase_data = {
                    "eventId": event_id,
                    "quantity": quantity,
                    "section": section
                }
                
                headers = self.headers.copy()
                if self.auth_token:
                    headers["Authorization"] = f"Bearer {self.auth_token}"
                
                try:
                    async with self.session.post(purchase_url, json=purchase_data, headers=headers) as response:
                        if response.status in (200, 201, 202):
                            data = await response.json()
                            logger.info(f"API purchase successful! Response: {data}")
                            return True
                        else:
                            logger.error(f"API purchase failed with status {response.status}")
                            return await self._fallback_to_playwright_purchase(event_url, event_info)
                except Exception as e:
                    logger.error(f"API purchase error: {str(e)}")
                    return await self._fallback_to_playwright_purchase(event_url, event_info)
            else:
                return await self._fallback_to_playwright_purchase(event_url, event_info)
                
        except Exception as e:
            logger.error(f"Error purchasing tickets: {str(e)}")
            return False

    async def _fallback_to_playwright_purchase(self, event_url: str, event_info: Dict[str, Any]) -> bool:
        """Use Playwright to purchase tickets"""
        logger.info("Using Playwright for ticket purchase")
        
        try:
            # Navigate to event page
            await self.page.goto(event_url)
            await self.page.wait_for_load_state("networkidle")
            
            # Look for and click book button
            book_selectors = [
                'a:has-text("Book Now")',
                'button:has-text("Book Now")',
                'a:has-text("Buy Tickets")',
                'button:has-text("Buy Tickets")',
                '.book-button',
                '[data-testid="book-button"]'
            ]
            
            # Add custom book button if found in event info
            if event_info.get("book_button"):
                book_selectors.insert(0, event_info["book_button"])
            
            button_clicked = False
            for selector in book_selectors:
                button = await self.page.query_selector(selector)
                if button:
                    await button.click()
                    button_clicked = True
                    logger.info(f"Clicked booking button with selector: {selector}")
                    await self.page.wait_for_load_state("networkidle")
                    break
            
            if not button_clicked:
                # If button wasn't found with specific selectors, try a wider approach
                book_xpath_selectors = [
                    "//a[contains(., 'Book')]",
                    "//button[contains(., 'Book')]",
                    "//a[contains(., 'Ticket')]",
                    "//button[contains(., 'Ticket')]",
                    "//a[contains(@href, 'book')]"
                ]
                
                for xpath in book_xpath_selectors:
                    button = await self.page.query_selector(xpath)
                    if button:
                        await button.click()
                        button_clicked = True
                        logger.info(f"Clicked booking button with xpath: {xpath}")
                        await self.page.wait_for_load_state("networkidle")
                        break
                        
            if not button_clicked:
                logger.error("Could not find any booking button")
                return False
            
            # Check if we're on a ticket selection page
            # May need to select ticket type or quantity
            ticket_qty_selectors = [
                'select[name="quantity"]',
                'input[type="number"][name="quantity"]',
                '.quantity-selector'
            ]
            
            for selector in ticket_qty_selectors:
                qty_input = await self.page.query_selector(selector)
                if qty_input:
                    quantity = self.config.get("ticket_preferences", {}).get("quantity", 1)
                    tag_name = await self.page.evaluate('el => el.tagName.toLowerCase()', qty_input)
                    
                    if tag_name == 'select':
                        await self.page.select_option(selector, str(quantity))
                    else:
                        await qty_input.fill(str(quantity))
                    
                    logger.info(f"Set ticket quantity to {quantity}")
                    break
            
            # Look for ticket type/section selection if required
            section_selectors = [
                '.ticket-type-option',
                '.section-option',
                'input[name="section"]',
                '[data-testid="section-option"]'
            ]
            
            for selector in section_selectors:
                options = await self.page.query_selector_all(selector)
                if options and len(options) > 0:
                    # Click the first available option if no preference
                    await options[0].click()
                    logger.info("Selected first available ticket section")
                    break
            
            # Look for continue/next/proceed buttons
            continue_selectors = [
                'button:has-text("Continue")',
                'button:has-text("Next")',
                'button:has-text("Proceed")',
                'button:has-text("Add to Cart")',
                'button[type="submit"]'
            ]
            
            for selector in continue_selectors:
                button = await self.page.query_selector(selector)
                if button:
                    await button.click()
                    logger.info(f"Clicked continue button: {selector}")
                    await self.page.wait_for_load_state("networkidle")
                    break
            
            # Handle checkout process
            # Look for checkout button
            checkout_selectors = [
                'button:has-text("Checkout")',
                'button:has-text("Place Order")',
                'button:has-text("Pay Now")',
                'button[type="submit"]'
            ]
            
            for selector in checkout_selectors:
                button = await self.page.query_selector(selector)
                if button:
                    await button.click()
                    logger.info(f"Clicked checkout button: {selector}")
                    await self.page.wait_for_load_state("networkidle")
                    break
            
            # Final confirmation (if needed)
            confirm_selectors = [
                'button:has-text("Confirm")',
                'button:has-text("Pay")',
                'button:has-text("Complete Purchase")',
                'button[type="submit"]'
            ]
            
            for selector in confirm_selectors:
                button = await self.page.query_selector(selector)
                if button:
                    await button.click()
                    logger.info(f"Clicked final confirmation button: {selector}")
                    await self.page.wait_for_load_state("networkidle")
                    break
            
            # Check for success indicators
            success_indicators = [
                'text=Thank you for your purchase',
                'text=Order Confirmation',
                'text=Your tickets',
                '.success-message',
                '.confirmation-message'
            ]
            
            for indicator in success_indicators:
                if await self.page.query_selector(indicator):
                    logger.info("Purchase successful! Found success indicator.")
                    
                    # Take a screenshot of the confirmation
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    await self.page.screenshot(path=f"purchase_confirmation_{timestamp}.png")
                    logger.info(f"Saved confirmation screenshot: purchase_confirmation_{timestamp}.png")
                    
                    return True
            
            # If we reached here but didn't find explicit success indicators,
            # check for other positive signs
            current_url = self.page.url
            if "confirmation" in current_url or "success" in current_url or "thank-you" in current_url:
                logger.info(f"Purchase likely successful. Current URL: {current_url}")
                
                # Take a screenshot just in case
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                await self.page.screenshot(path=f"purchase_confirmation_{timestamp}.png")
                logger.info(f"Saved confirmation screenshot: purchase_confirmation_{timestamp}.png")
                
                return True
            
            logger.warning("Could not confirm purchase success")
            return False
            
        except Exception as e:
            logger.error(f"Error in Playwright purchase flow: {str(e)}")
            return False

    async def close(self):
        """Clean up resources"""
        logger.info("Closing resources...")
        if self.session:
            await self.session.close()
            
        if self.browser:
            await self.browser.close()
            
        if self.playwright:
            await self.playwright.stop()
            
        logger.info("All resources closed")

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
        else:
            logger.error("Login failed. Please check your credentials.")
    finally:
        await bot.close()

if __name__ == "__main__":
    asyncio.run(main()) 