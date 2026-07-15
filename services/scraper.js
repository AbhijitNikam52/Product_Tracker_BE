const { chromium } = require('playwright');
const url = require('url');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36'
];

const cleanUrl = (productUrl) => {
  try {
    const parsed = new URL(productUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes('amazon.')) {
      const dpMatch = parsed.pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/i);
      if (dpMatch) {
        return `${parsed.origin}/dp/${dpMatch[2]}`;
      }
    } else if (hostname.includes('flipkart.com')) {
      const pid = parsed.searchParams.get('pid');
      if (pid) {
        return `${parsed.origin}${parsed.pathname}?pid=${pid}`;
      }
      return `${parsed.origin}${parsed.pathname}`;
    } else if (hostname.includes('myntra.com') || hostname.includes('ajio.com') || hostname.includes('meesho.com')) {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return productUrl;
  } catch (e) {
    return productUrl;
  }
};

const scrapeAmazonCoupons = async (page) => {
  const coupons = [];
  try {
    const badgeEl = page.locator('#couponBadgeInsideCard, #couponBadge, .promoPriceBlockMessage, #applicable_coupons_base');
    const count = await badgeEl.count();
    for (let i = 0; i < count; i++) {
      const txt = await badgeEl.nth(i).innerText();
      if (txt && txt.trim()) {
        const cleanTxt = txt.replace(/\s+/g, ' ').trim();
        coupons.push({
          code: '',
          description: cleanTxt,
          couponType: 'product',
          discountType: cleanTxt.includes('%') ? 'percentage' : 'fixed',
          isVerified: true,
          source: 'scraped'
        });
      }
    }
  } catch (e) {
    console.error('Error scraping Amazon coupons:', e.message);
  }

  try {
    const bankOfferEl = page.locator('#bankOffers_feature_div .sw-offers-text, #bankOffers_feature_div .a-carousel-card, #sopp-cardOffers .a-carousel-card');
    const count = await bankOfferEl.count();
    for (let i = 0; i < count; i++) {
      const txt = await bankOfferEl.nth(i).innerText();
      if (txt && txt.trim()) {
        const cleanTxt = txt.replace(/\s+/g, ' ').trim();
        if (cleanTxt && !coupons.some(c => c.description === cleanTxt)) {
          coupons.push({
            code: '',
            description: cleanTxt,
            couponType: 'bank_offer',
            isVerified: true,
            source: 'scraped'
          });
        }
      }
    }
  } catch (e) {
    console.error('Error scraping Amazon bank offers:', e.message);
  }
  return coupons;
};

const scrapeFlipkartCoupons = async (page) => {
  const coupons = [];
  try {
    const offerLocator = page.locator('li.YtuZUB, li.y3Z8r3, li._1ma8ca, div.x3Z8r3');
    const count = await offerLocator.count();
    for (let i = 0; i < count; i++) {
      const txt = await offerLocator.nth(i).innerText();
      if (txt && txt.trim()) {
        const cleanTxt = txt.replace(/\s+/g, ' ').trim();
        let couponType = 'bank_offer';
        if (cleanTxt.toLowerCase().includes('coupon')) {
          couponType = 'product';
        }
        
        let code = '';
        const codeMatch = cleanTxt.match(/use\s+code\s+([A-Z0-9]+)/i) || cleanTxt.match(/code:\s*([A-Z0-9]+)/i);
        if (codeMatch) {
          code = codeMatch[1];
        }

        if (!coupons.some(c => c.description === cleanTxt)) {
          coupons.push({
            code,
            description: cleanTxt,
            couponType,
            isVerified: true,
            source: 'scraped'
          });
        }
      }
    }
  } catch (e) {
    console.error('Error scraping Flipkart coupons:', e.message);
  }
  return coupons;
};

const scrapeMyntraCoupons = async (page) => {
  const coupons = [];
  try {
    const couponLocator = page.locator('.best-offers-offer, .pdp-offers-container, .myntra-coupons-list-item');
    const count = await couponLocator.count();
    for (let i = 0; i < count; i++) {
      const txt = await couponLocator.nth(i).innerText();
      if (txt && txt.trim()) {
        const cleanTxt = txt.replace(/\s+/g, ' ').trim();
        let code = '';
        const codeMatch = cleanTxt.match(/use\s+code\s+([A-Z0-9]+)/i) || cleanTxt.match(/code:\s*([A-Z0-9]+)/i);
        if (codeMatch) {
          code = codeMatch[1];
        }

        if (!coupons.some(c => c.description === cleanTxt)) {
          coupons.push({
            code,
            description: cleanTxt,
            couponType: 'product',
            isVerified: true,
            source: 'scraped'
          });
        }
      }
    }
  } catch (e) {
    console.error('Error scraping Myntra coupons:', e.message);
  }
  return coupons;
};

const scrapeAjioCoupons = async (page) => {
  const coupons = [];
  try {
    const couponLocator = page.locator('.promo-desc, .promo-title, .offer-item, .pdp-coupon-container');
    const count = await couponLocator.count();
    for (let i = 0; i < count; i++) {
      const txt = await couponLocator.nth(i).innerText();
      if (txt && txt.trim()) {
        const cleanTxt = txt.replace(/\s+/g, ' ').trim();
        let code = '';
        const codeMatch = cleanTxt.match(/use\s+code\s+([A-Z0-9]+)/i) || cleanTxt.match(/code:\s*([A-Z0-9]+)/i);
        if (codeMatch) {
          code = codeMatch[1];
        }

        if (!coupons.some(c => c.description === cleanTxt)) {
          coupons.push({
            code,
            description: cleanTxt,
            couponType: 'product',
            isVerified: true,
            source: 'scraped'
          });
        }
      }
    }
  } catch (e) {
    console.error('Error scraping Ajio coupons:', e.message);
  }
  return coupons;
};

const scrapeGenericCoupons = async (page) => {
  const coupons = [];
  try {
    const elementLocator = page.locator('[class*="coupon" i], [class*="offer" i], [class*="promo" i]');
    const count = await elementLocator.count();
    const limit = Math.min(count, 10);
    for (let i = 0; i < limit; i++) {
      const txt = await elementLocator.nth(i).innerText();
      if (txt && txt.trim() && txt.length < 200) {
        const cleanTxt = txt.replace(/\s+/g, ' ').trim();
        const lower = cleanTxt.toLowerCase();
        if (lower.includes('off') || lower.includes('discount') || lower.includes('cashback') || lower.includes('code') || lower.includes('save')) {
          let code = '';
          const codeMatch = cleanTxt.match(/use\s+code\s+([A-Z0-9]+)/i) || cleanTxt.match(/code:\s*([A-Z0-9]+)/i);
          if (codeMatch) {
            code = codeMatch[1];
          }

          if (!coupons.some(c => c.description === cleanTxt)) {
            coupons.push({
              code,
              description: cleanTxt,
              couponType: lower.includes('bank') ? 'bank_offer' : 'product',
              isVerified: true,
              source: 'scraped'
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error scraping generic coupons:', e.message);
  }
  return coupons;
};

/**
 * Scrapes a product URL for price, title, image, site, currency and coupons
 * @param {string} productUrl 
 * @returns {Promise<{price: number, productName: string, imageUrl: string, site: string, currency: string, coupons: Array}>}
 */
const scrape = async (productUrl) => {
  let browser;
  try {
    const cleanedProductUrl = cleanUrl(productUrl);
    const parsedUrl = new url.URL(cleanedProductUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Determine site identifier & default currency
    let site = 'generic';
    let currency = 'INR';
    if (hostname.includes('amazon.in')) {
      site = 'amazon';
      currency = 'INR';
    } else if (hostname.includes('amazon.com')) {
      site = 'amazon';
      currency = 'USD';
    } else if (hostname.includes('flipkart.com')) {
      site = 'flipkart';
      currency = 'INR';
    } else if (hostname.includes('myntra.com')) {
      site = 'myntra';
      currency = 'INR';
    } else if (hostname.includes('ajio.com')) {
      site = 'ajio';
      currency = 'INR';
    } else if (hostname.includes('meesho.com')) {
      site = 'meesho';
      currency = 'INR';
    }

    // Select random User Agent
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-http2'
      ]
    });

    const context = await browser.newContext({
      userAgent: randomUserAgent,
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const page = await context.newPage();
    
    // Set a reasonable navigation timeout
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);

    // Block non-essential resources to speed up page loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Go to the target page
    console.log(`Scraping URL: ${cleanedProductUrl} with User-Agent: ${randomUserAgent}`);
    await page.goto(cleanedProductUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Let any dynamically-rendered values settle slightly
    await page.waitForTimeout(2000);

    // Extract product title/name
    let productName = '';
    try {
      // 1. Try og:title
      productName = await page.locator('meta[property="og:title"]').getAttribute('content');
    } catch (e) {}

    if (!productName) {
      try {
        // 2. Try page title
        productName = await page.title();
      } catch (e) {}
    }
    
    if (productName) {
      productName = productName.trim();
    } else {
      productName = 'Tracked Product';
    }

    // Verify if page loaded successfully or was blocked
    const lowerTitle = productName.toLowerCase();
    if (!productName || productName === 'Tracked Product' || lowerTitle.includes('page not found') || lowerTitle.includes('something went wrong') || lowerTitle.includes('robot check') || lowerTitle.includes('captcha')) {
      throw new Error('SCRAPE_FAILED: Product page could not be loaded or was blocked.');
    }

    // Extract product image URL
    let imageUrl = '';
    try {
      imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
    } catch (e) {}

    // Fallbacks for specific sites if og:image is missing
    if (!imageUrl) {
      try {
        if (site === 'amazon') {
          const imgSelectors = ['#landingImage', '#imgBlkFront', '#main-image', '.imgTagWrapper img'];
          for (const selector of imgSelectors) {
            const el = page.locator(selector).first();
            if (await el.isVisible()) {
              const src = await el.getAttribute('src');
              if (src) {
                imageUrl = src;
                break;
              }
            }
          }
        } else if (site === 'flipkart') {
          const imgSelectors = ['img._396cs4', 'img._2r3Ww_', 'div._3kidCm img', 'img[src*="flipkart.com/image/"]', 'img._1BDryT'];
          for (const selector of imgSelectors) {
            const el = page.locator(selector).first();
            if (await el.isVisible()) {
              const src = await el.getAttribute('src');
              if (src) {
                imageUrl = src;
                break;
              }
            }
          }
        }
      } catch (imgErr) {
        console.error('Fallback image extraction error:', imgErr.message);
      }
    }

    // Generic fallback for any site if still empty
    if (!imageUrl) {
      try {
        const selectors = [
          'main img',
          'article img',
          '#product-image img',
          '.product-image img',
          '.gallery img',
          'div[class*="image"] img',
          'div[class*="gallery"] img',
          'img'
        ];
        for (const selector of selectors) {
          const el = page.locator(selector).first();
          if (await el.isVisible()) {
            const src = await el.getAttribute('src');
            if (src && src.startsWith('http')) {
              imageUrl = src;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // Extract price based on selectors
    let priceText = '';

    if (site === 'amazon') {
      const selectors = [
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        '#corePrice_desktop .a-offscreen',
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice'
      ];
      for (const selector of selectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible()) {
            priceText = await el.innerText() || await el.textContent();
            if (priceText) break;
          }
        } catch (e) {}
      }
    } else if (site === 'flipkart') {
      const selectors = [
        '._30jeq3._16Jk6d',
        '._30jeq3',
        '.Nx9beo .C13JWS',
        '[class*="_30jeq3"]'
      ];
      for (const selector of selectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible()) {
            priceText = await el.innerText() || await el.textContent();
            if (priceText) break;
          }
        } catch (e) {}
      }
    } else if (site === 'myntra') {
      const selectors = [
        '.pdp-price strong',
        '.pdp-discounted-price'
      ];
      for (const selector of selectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible()) {
            priceText = await el.innerText() || await el.textContent();
            if (priceText) break;
          }
        } catch (e) {}
      }
    } else if (site === 'ajio') {
      const selectors = [
        '.prod-sp',
        '.prod-price-section'
      ];
      for (const selector of selectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible()) {
            priceText = await el.innerText() || await el.textContent();
            if (priceText) break;
          }
        } catch (e) {}
      }
    } else if (site === 'meesho') {
      const selectors = [
        '.sc-dkrFOg h4',
        '[class*="PriceText"]',
        'h4'
      ];
      for (const selector of selectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible()) {
            priceText = await el.innerText() || await el.textContent();
            if (priceText) break;
          }
        } catch (e) {}
      }
    }

    // Generic Fallback Regex Scan
    if (!priceText || priceText.trim() === '') {
      console.log('Specific selectors failed. Attempting generic text search...');
      // Extract entire text content from the body element
      const bodyText = await page.locator('body').innerText();
      
      // Look for price patterns like ₹ 12,999 or $45.99
      // Regex matches rupee or dollar signs followed by digits, commas, and optionally decimals
      const rupeeRegex = /₹\s*([0-9,]+)/g;
      const dollarRegex = /\$\s*([0-9,.]+)/g;

      if (currency === 'INR') {
        const matches = [...bodyText.matchAll(rupeeRegex)];
        if (matches && matches.length > 0) {
          // Take first match
          priceText = matches[0][1];
        }
      } else {
        const matches = [...bodyText.matchAll(dollarRegex)];
        if (matches && matches.length > 0) {
          priceText = matches[0][1];
        }
      }
      
      // If still not found, try any generic currency symbol
      if (!priceText) {
        const anyPriceRegex = /[₹$]\s*([0-9,.]+)/;
        const match = bodyText.match(anyPriceRegex);
        if (match) {
          priceText = match[1];
        }
      }
    }

    // Clean and Parse Price
    let parsedPrice = null;
    if (priceText) {
      // Remove symbols, spaces, commas
      const cleanText = priceText.replace(/[₹$,\s]/g, '');
      parsedPrice = parseFloat(cleanText);
    }

    // Final checks: if price is missing or not a number, set to null (allows tracking out-of-stock items)
    if (!parsedPrice || isNaN(parsedPrice)) {
      parsedPrice = null;
    }

    // Scrape coupons & bank offers
    let coupons = [];
    try {
      if (site === 'amazon') {
        coupons = await scrapeAmazonCoupons(page);
      } else if (site === 'flipkart') {
        coupons = await scrapeFlipkartCoupons(page);
      } else if (site === 'myntra') {
        coupons = await scrapeMyntraCoupons(page);
      } else if (site === 'ajio') {
        coupons = await scrapeAjioCoupons(page);
      } else {
        coupons = await scrapeGenericCoupons(page);
      }
    } catch (couponErr) {
      console.error('Error scraping coupons/offers:', couponErr.message);
    }

    // Close browser cleanly
    await context.close();
    await browser.close();
    browser = null;

    return {
      price: parsedPrice,
      productName: productName.substring(0, 150), // prevent too long title
      imageUrl: imageUrl || '',
      site,
      currency,
      coupons
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Error during scraping:', error.message);
    throw error;
  }
};

module.exports = {
  scrape,
  scrapeAmazonCoupons,
  scrapeFlipkartCoupons,
  scrapeMyntraCoupons,
  scrapeAjioCoupons,
  scrapeGenericCoupons
};
