const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Testing ion-icon rendering on http://localhost:5173');
  console.log('-----------------------------------------------------------\n');

  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Collect console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      
      // Filter for ion-icon related messages
      if (text.toLowerCase().includes('ion-icon') || 
          text.toLowerCase().includes('custom element') || 
          text.toLowerCase().includes('icon') ||
          text.toLowerCase().includes('ionicons')) {
        console.log(`[${type.toUpperCase()}] ${text}`);
      }
    });

    // Collect errors
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to page
    console.log('Step 1: Loading page...');
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });

    // Wait for initial render
    console.log('Step 2: Waiting for UI render...\n');
    await page.waitForTimeout(2000);

    // Check if ion-icon tags exist
    console.log('Step 3: Inspecting ion-icon elements...');
    const ionIconCount = await page.evaluate(() => {
      return document.querySelectorAll('ion-icon').length;
    });
    console.log(`   Found ${ionIconCount} ion-icon elements\n`);

    // Check if they're actually rendered (have shadow DOM)
    const ionIconsHydrated = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('ion-icon'));
      return icons.map(icon => ({
        name: icon.getAttribute('name'),
        hasClass: icon.classList.contains('hydrated'),
        hasShadowRoot: !!icon.shadowRoot,
        computedDisplay: window.getComputedStyle(icon).display
      }));
    });

    console.log('Step 4: Checking ion-icon hydration status:');
    ionIconsHydrated.forEach((icon, idx) => {
      console.log(`   Icon ${idx + 1}: name="${icon.name}", hydrated=${icon.hasClass}, shadowRoot=${icon.hasShadowRoot}, display=${icon.computedDisplay}`);
    });
    console.log('');

    // Check for missing icon placeholders
    const missingIcons = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('ion-icon'));
      return icons.filter(icon => {
        const styles = window.getComputedStyle(icon);
        return styles.display === 'none' || styles.visibility === 'hidden' || !icon.shadowRoot;
      }).map(icon => icon.getAttribute('name'));
    });

    if (missingIcons.length > 0) {
      console.log(`⚠️  Found ${missingIcons.length} potentially broken icons: ${missingIcons.join(', ')}\n`);
    }

    // Check for network errors related to ionicons
    console.log('Step 5: Checking browser console for errors...');
    const ionIconErrors = consoleMessages.filter(msg => 
      (msg.type === 'error' || msg.type === 'warning') &&
      (msg.text.toLowerCase().includes('ion-icon') || 
       msg.text.toLowerCase().includes('ionicons') ||
       msg.text.toLowerCase().includes('custom element'))
    );

    if (ionIconErrors.length === 0 && errors.length === 0) {
      console.log('   ✅ No ion-icon related errors in console\n');
    } else {
      console.log(`   ❌ Found ${ionIconErrors.length + errors.length} errors/warnings:`);
      ionIconErrors.forEach(msg => console.log(`      [${msg.type}] ${msg.text}`));
      errors.forEach(err => console.log(`      [ERROR] ${err}`));
      console.log('');
    }

    // Final verdict
    console.log('-----------------------------------------------------------');
    console.log('📊 TEST RESULTS:');
    console.log('-----------------------------------------------------------');
    
    const allHydrated = ionIconsHydrated.every(icon => icon.hasClass && icon.hasShadowRoot);
    const hasErrors = ionIconErrors.length > 0 || errors.length > 0;
    
    if (ionIconCount === 0) {
      console.log('⚠️  INCONCLUSIVE: No ion-icon elements found on page');
      console.log('    This may be because the page requires interaction or authentication');
    } else if (allHydrated && !hasErrors && missingIcons.length === 0) {
      console.log('✅ PASS: All ion-icons are rendering correctly');
      console.log(`    - ${ionIconCount} icons found`);
      console.log('    - All icons hydrated with shadow DOM');
      console.log('    - No console errors');
    } else {
      console.log('❌ FAIL: ion-icon issues detected');
      if (!allHydrated) console.log('    - Some icons not properly hydrated');
      if (missingIcons.length > 0) console.log(`    - ${missingIcons.length} icons not rendering`);
      if (hasErrors) console.log('    - Console errors detected');
    }
    console.log('-----------------------------------------------------------\n');

    // Print all console errors for reference
    if (ionIconErrors.length > 0 || errors.length > 0) {
      console.log('EXACT CONSOLE ERROR TEXT:');
      console.log('-----------------------------------------------------------');
      ionIconErrors.forEach(msg => console.log(`[${msg.type.toUpperCase()}] ${msg.text}`));
      errors.forEach(err => console.log(`[ERROR] ${err}`));
      console.log('-----------------------------------------------------------\n');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
