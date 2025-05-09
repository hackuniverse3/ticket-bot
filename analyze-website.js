const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Starting website analysis...');
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: false, // Set to false to see the browser
      defaultViewport: null,
      args: ['--window-size=1366,768']
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Navigate to webook.com
    console.log('Navigating to webook.com...');
    await page.goto('https://webook.com', { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Log the page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Check for login elements
    console.log('\nLooking for login elements...');
    const loginSelectors = [
      '.login-button', '.login', '.signin', '#login', 
      '[href*="login"]', '[href*="signin"]',
      'button', 'a.login', 'a.signin'
    ];
    
    for (const selector of loginSelectors) {
      try {
        const exists = await page.$(selector);
        if (exists) {
          console.log(`Found login element: ${selector}`);
          
          // Get the text if it's a button or link
          if (selector.startsWith('button') || selector.startsWith('a')) {
            const text = await page.$eval(selector, el => el.textContent.trim());
            console.log(`  Text: ${text}`);
          }
        }
      } catch (error) {
        // Ignore errors for selectors that don't exist
      }
    }
    
    // Check for match search elements
    console.log('\nLooking for search/match elements...');
    const searchSelectors = [
      '#search-input', '.search-input', '[placeholder*="search"]',
      '#search-button', '.search-button', 'button[type="search"]',
      '.match-list', '.match-results', '.matches', '.events',
      '.match-item', '.match-card', '.event-item'
    ];
    
    for (const selector of searchSelectors) {
      try {
        const exists = await page.$(selector);
        if (exists) {
          console.log(`Found search/match element: ${selector}`);
        }
      } catch (error) {
        // Ignore errors for selectors that don't exist
      }
    }
    
    // Check for ticket elements
    console.log('\nLooking for ticket elements...');
    const ticketSelectors = [
      '.ticket-availability', '.availability', '.status',
      '.quantity', '#quantity-dropdown', 'select[name*="quantity"]',
      '.buy-button', '#buy-tickets-button', 'button[contains(@class, "buy")]',
      'button[contains(@class, "purchase")]', '.purchase', '#confirm-purchase'
    ];
    
    for (const selector of ticketSelectors) {
      try {
        const exists = await page.$(selector);
        if (exists) {
          console.log(`Found ticket element: ${selector}`);
        }
      } catch (error) {
        // Ignore errors for selectors that don't exist
      }
    }
    
    // Look for all buttons and links that might be related to tickets
    console.log('\nAll potential ticket-related buttons:');
    const buttonTexts = await page.$$eval('button, a.button, a.btn', elements => {
      return elements.map(el => ({
        text: el.textContent.trim(),
        class: el.className,
        id: el.id,
        disabled: el.disabled
      }));
    });
    
    buttonTexts.forEach(btn => {
      if (btn.text.toLowerCase().includes('buy') || 
          btn.text.toLowerCase().includes('ticket') ||
          btn.text.toLowerCase().includes('book') ||
          btn.text.toLowerCase().includes('purchase')) {
        console.log(JSON.stringify(btn, null, 2));
      }
    });
    
    // Extract all forms
    console.log('\nForms found on the page:');
    const forms = await page.$$eval('form', forms => {
      return forms.map(form => ({
        id: form.id,
        action: form.action,
        method: form.method,
        inputs: Array.from(form.querySelectorAll('input, select, button[type="submit"]')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          class: input.className
        }))
      }));
    });
    
    console.log(JSON.stringify(forms, null, 2));
    
    // Capture a screenshot
    await page.screenshot({ path: 'webook-homepage.png' });
    console.log('Screenshot saved as webook-homepage.png');
    
    // Wait for user input before closing
    console.log('\nPress Enter to close the browser...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    await browser.close();
    console.log('Analysis complete');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
})(); 