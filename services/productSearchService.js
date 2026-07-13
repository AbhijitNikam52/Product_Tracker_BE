const { chromium } = require('playwright');
const url = require('url');
const scraper = require('./scraper');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
];

const PLATFORMS = {
  amazon: {
    name: 'Amazon',
    searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
    firstLinkSelector: 'div[data-component-type="s-search-result"] h2 a.a-link-normal, a.a-link-normal.s-no-outline, a[href*="/dp/"]',
    titleSelectors: ['#productTitle', 'h1', 'meta[property="og:title"]', '.a-size-large'],
    priceSelectors: [
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '#corePrice_desktop .a-offscreen',
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole'
    ],
    imageSelectors: ['#landingImage', '#imgBlkFront', '#main-image', 'meta[property="og:image"]'],
    ratingSelectors: ['span.a-icon-alt', '#acrPopover', 'span[aria-label*="out of 5 stars"]'],
    domain: 'https://www.amazon.in'
  },
  flipkart: {
    name: 'Flipkart',
    searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
    firstLinkSelector: 'a[href*="/p/"]',
    titleSelectors: ['span.B_NuCI', 'span.VU-ZEg', 'h1 span', 'meta[property="og:title"]'],
    priceSelectors: ['div._30jeq3._16Jk6d', 'div.Nx9beo div.C13JWS', 'div[class*="_30jeq3"]', 'div.Nx9beo'],
    imageSelectors: ['img._396cs4', 'img.CXW8mj', 'meta[property="og:image"]', 'img._0DkuPH'],
    ratingSelectors: ['div._3LWZlK', 'div.ipqd2A', 'span._2_R_DZ'],
    domain: 'https://www.flipkart.com'
  },
  myntra: {
    name: 'Myntra',
    searchUrl: (q) => `https://www.myntra.com/${encodeURIComponent(q)}`,
    firstLinkSelector: 'li.product-base a, a[href*="/buy/"]',
    titleSelectors: ['h1.pdp-title', 'h1.pdp-name', 'meta[property="og:title"]'],
    priceSelectors: ['span.pdp-price strong', 'span.pdp-discounted-price', '.pdp-price'],
    imageSelectors: ['img.pdp-main-img', 'meta[property="og:image"]'],
    ratingSelectors: ['div.index-overallRating', 'span.index-ratingsCount'],
    domain: 'https://www.myntra.com'
  },
  ajio: {
    name: 'Ajio',
    searchUrl: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
    firstLinkSelector: 'a.rilrtl-products-list__link, div.item a, a[href*="/p/"]',
    titleSelectors: ['h1.prod-name', 'meta[property="og:title"]'],
    priceSelectors: ['span.prod-sp', 'span.prod-price-section', '.prod-sp'],
    imageSelectors: ['img.rilrtl-lazy-img', 'img.prod-main-img', 'meta[property="og:image"]'],
    ratingSelectors: ['div.prod-rating-section', 'span.rating-value'],
    domain: 'https://www.ajio.com'
  },
  croma: {
    name: 'Croma',
    searchUrl: (q) => `https://www.croma.com/search/?q=${encodeURIComponent(q)}`,
    firstLinkSelector: 'a.product-title, div.plp-prod-title-link a, a[href*="/p/"]',
    titleSelectors: ['h1#pdp-product-title', 'h1', 'meta[property="og:title"]'],
    priceSelectors: ['span#pdp-product-price', '.price', 'span.amount'],
    imageSelectors: ['img#main-product-img', 'meta[property="og:image"]', 'div.pdp-img-wrap img'],
    ratingSelectors: ['span.product-rating', 'span.rating-stars'],
    domain: 'https://www.croma.com'
  },
  reliancedigital: {
    name: 'Reliance Digital',
    searchUrl: (q) => `https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`,
    firstLinkSelector: 'li.spgrid a, div.slider-item a, a[href*="/p/"]',
    titleSelectors: ['h1.pdp__title', 'h1', 'meta[property="og:title"]'],
    priceSelectors: ['span.pdp__priceSection__price', 'span.amount'],
    imageSelectors: ['img#pdpImg', 'meta[property="og:image"]'],
    ratingSelectors: ['.pdp__rating', 'span.rating-stars'],
    domain: 'https://www.reliancedigital.in'
  },
  vijaysales: {
    name: 'Vijay Sales',
    searchUrl: (q) => `https://www.vijaysales.com/search/${encodeURIComponent(q)}`,
    firstLinkSelector: 'div.v-prod-title a, a.v-prod-title, a[href*="/products/"]',
    titleSelectors: ['h1.pdp-title', 'h1', 'meta[property="og:title"]'],
    priceSelectors: ['span.pdp-price', 'span.amount'],
    imageSelectors: ['img#main-product-img', 'meta[property="og:image"]'],
    ratingSelectors: ['span.pdp-rating', 'span.rating-stars'],
    domain: 'https://www.vijaysales.com'
  }
};

/**
 * Checks if the scraped product title matches key terms from the query to filter out irrelevant recommendations.
 */
const checkRelevance = (query, title) => {
  if (!title) return false;
  // Extract keywords of length > 2 and exclude generic helper words
  const ignoreList = ['and', 'for', 'the', 'with', 'off', 'star', 'pro', 'max', 'plus', 'in', 'on', 'at', 'by'];
  const queryWords = query
    .toLowerCase()
    .split(/[^a-z0-9]/)
    .filter(w => w.length > 2 && !ignoreList.includes(w));
    
  if (queryWords.length === 0) return true; // Fallback to avoid filtering empty keyword lists
  
  const titleLower = title.toLowerCase();
  // Ensure at least one significant keyword matches the title
  return queryWords.some(word => titleLower.includes(word));
};

/**
 * Scrapes detailed information from a product page
 */
const scrapeProductPage = async (page, platform, productUrl, platformKey) => {
  try {
    console.log(`[Scraper] Navigating to product page: ${productUrl}`);
    // Wait for DOM content to load with a 30 second timeout
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract Title
    let title = '';
    for (const selector of platform.titleSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible()) {
          title = await el.innerText() || await el.textContent();
          if (title) break;
        }
      } catch (e) {}
    }
    if (!title) {
      try {
        title = await page.locator('meta[property="og:title"]').getAttribute('content');
      } catch (e) {}
    }
    if (!title) {
      title = await page.title();
    }
    title = title ? title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // Extract Price
    let priceText = '';
    for (const selector of platform.priceSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible()) {
          priceText = await el.innerText() || await el.textContent();
          if (priceText) break;
        }
      } catch (e) {}
    }
    
    // Fallback: search page body for rupee patterns
    if (!priceText || priceText.trim() === '') {
      try {
        const bodyText = await page.locator('body').innerText();
        const rupeeRegex = /₹\s*([0-9,]+)/;
        const match = bodyText.match(rupeeRegex);
        if (match) {
          priceText = match[1];
        }
      } catch (e) {}
    }

    let price = null;
    if (priceText) {
      const cleanText = priceText.replace(/[₹$,\s]/g, '');
      price = parseFloat(cleanText);
    }
    if (isNaN(price)) {
      price = null;
    }

    // Extract Image URL
    let imageUrl = '';
    for (const selector of platform.imageSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible()) {
          if (selector.startsWith('meta')) {
            imageUrl = await el.getAttribute('content');
          } else {
            imageUrl = await el.getAttribute('src') || await el.getAttribute('data-src') || await el.getAttribute('data-old-hires');
          }
          if (imageUrl) break;
        }
      } catch (e) {}
    }
    if (!imageUrl) {
      try {
        imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
      } catch (e) {}
    }
    // Clean relative image urls
    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl && imageUrl.startsWith('/')) {
      imageUrl = platform.domain + imageUrl;
    }

    // Extract Rating
    let rating = '';
    for (const selector of platform.ratingSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible()) {
          rating = await el.innerText() || await el.textContent() || await el.getAttribute('aria-label') || await el.getAttribute('content');
          if (rating) break;
        }
      } catch (e) {}
    }
    // Clean rating string
    if (rating) {
      rating = rating.trim().replace(/out of 5 stars/i, '').trim();
      // Extract decimal rating
      const ratingMatch = rating.match(/([0-9.]+)/);
      if (ratingMatch) {
        rating = ratingMatch[1];
      }
    }

    // Scrape coupons & bank offers
    let coupons = [];
    try {
      if (platformKey === 'amazon') {
        coupons = await scraper.scrapeAmazonCoupons(page);
      } else if (platformKey === 'flipkart') {
        coupons = await scraper.scrapeFlipkartCoupons(page);
      } else if (platformKey === 'myntra') {
        coupons = await scraper.scrapeMyntraCoupons(page);
      } else if (platformKey === 'ajio') {
        coupons = await scraper.scrapeAjioCoupons(page);
      } else {
        coupons = await scraper.scrapeGenericCoupons(page);
      }
    } catch (couponErr) {
      console.error('[Search Scraper] Error scraping coupons:', couponErr.message);
    }

    return {
      title: title || 'Product details found',
      price,
      imageUrl: imageUrl || '',
      rating: rating || '',
      coupons
    };
  } catch (err) {
    console.error(`[Scraper] Failed to scrape product page: ${productUrl}`, err.message);
    throw err;
  }
};

/**
 * Searches a platform and opens the first product page to scrape it
 */
const searchAndScrape = async (browser, platformKey, query) => {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    return {
      site: platformKey,
      siteName: platformKey.toUpperCase(),
      status: 'failed',
      error: 'Platform configuration not found.'
    };
  }

  // Create a clean browser context
  const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  let context;
  try {
    context = await browser.newContext({
      userAgent: randomUserAgent,
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(25000);
    page.setDefaultTimeout(25000);

    // Block non-essential heavy assets (stylesheet, image, font, media) to make page loads extremely fast
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const searchUrl = platform.searchUrl(query);
    console.log(`[Search] Searching ${platform.name}: ${searchUrl}`);
    
    // Go to search page and wait for DOM Content to load
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3000); // Wait for scripts to populate results

    // Check if we hit "Access Denied" or bot check
    const pageTitle = await page.title();
    if (pageTitle && (pageTitle.toLowerCase().includes('access denied') || pageTitle.toLowerCase().includes('attention required') || pageTitle.toLowerCase().includes('security check'))) {
      throw new Error('Access Denied: Connection blocked by store protection system.');
    }

    // Locate first product link (excluding ad-clicks/sponsored ads)
    let productUrl = '';
    try {
      const links = await page.locator(platform.firstLinkSelector).all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href) {
          const isAd = href.includes('/sspa/') || href.includes('/click?') || href.includes('adurl') || href.includes('adSystem') || href.includes('googleads') || href.includes('aax-');
          if (!isAd) {
            productUrl = href;
            break;
          }
        }
      }
    } catch (e) {}

    // Fallback: search all links in the page for product matches (excluding ads)
    if (!productUrl) {
      try {
        const anchors = await page.locator('a').all();
        for (const a of anchors) {
          const href = await a.getAttribute('href');
          if (href) {
            const hasProductPattern = href.includes('/dp/') || href.includes('/p/') || href.includes('/buy/') || href.includes('/products/');
            const isAd = href.includes('/sspa/') || href.includes('/click?') || href.includes('adurl') || href.includes('adSystem') || href.includes('googleads') || href.includes('aax-');
            if (hasProductPattern && !isAd && !href.includes('/help/') && !href.includes('/reviews/')) {
              productUrl = href;
              break;
            }
          }
        }
      } catch (e) {}
    }

    if (!productUrl) {
      throw new Error('Could not find any product matching the search query.');
    }

    // Convert relative URL to absolute
    if (productUrl.startsWith('//')) {
      productUrl = 'https:' + productUrl;
    } else if (productUrl.startsWith('/')) {
      productUrl = platform.domain + productUrl;
    }

    // Strip tracking parameters to keep product URL clean
    try {
      const parsed = new URL(productUrl);
      if (platformKey === 'amazon') {
        const dpMatch = parsed.pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/i);
        if (dpMatch) {
          productUrl = `${parsed.origin}/dp/${dpMatch[2]}`;
        }
      } else if (platformKey === 'flipkart') {
        const pid = parsed.searchParams.get('pid');
        if (pid) {
          productUrl = `${parsed.origin}${parsed.pathname}?pid=${pid}`;
        } else {
          productUrl = `${parsed.origin}${parsed.pathname}`;
        }
      }
    } catch (e) {}

    // Navigating & scraping product page details
    const details = await scrapeProductPage(page, platform, productUrl, platformKey);
    
    // Validate relevance of scraped product to filter out unrelated ads/recommendations
    if (!checkRelevance(query, details.title)) {
      throw new Error('Could not find any matching product (matched query relevance check failed).');
    }

    await context.close();
    return {
      site: platformKey,
      siteName: platform.name,
      status: 'success',
      productUrl,
      ...details
    };

  } catch (error) {
    console.error(`[Search] Failed scraping platform ${platform.name}:`, error.message);
    if (context) {
      try { await context.close(); } catch (e) {}
    }
    return {
      site: platformKey,
      siteName: platform.name,
      status: 'failed',
      error: error.message || 'Scrape failed',
      title: '',
      price: null,
      imageUrl: '',
      rating: '',
      productUrl: ''
    };
  }
};

/**
 * Executes search on all e-commerce platforms sequentially to avoid memory/CPU bottleneck and timeouts
 */
const searchAll = async (query) => {
  console.log(`[SearchService] Executing sequential cross-platform search for: "${query}"`);
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-http2'
    ]
  });

  const results = [];
  try {
    const platforms = Object.keys(PLATFORMS);
    
    for (const key of platforms) {
      console.log(`[SearchService] Scraping ${key}...`);
      const res = await searchAndScrape(browser, key, query);
      results.push(res);
    }

    console.log(`[SearchService] Cross-platform search complete.`);
    await browser.close();
    return results;
  } catch (err) {
    console.error('[SearchService] Error during searchAll:', err.message);
    try { await browser.close(); } catch (e) {}
    throw err;
  }
};

module.exports = {
  searchAll
};
