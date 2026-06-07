const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[pageerror] ${error.message}`);
    console.log(error.stack);
  });
  
  console.log("Navigating to localhost:1420...");
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });
  
  console.log("Waiting 3s for any runtime errors...");
  await page.waitForTimeout(3000);
  
  await browser.close();
})();
