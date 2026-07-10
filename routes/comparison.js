const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const ComparisonProduct = require('../models/ComparisonProduct');
const scraper = require('../services/scraper');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/comparison
// Retrieve all comparison products for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const products = await ComparisonProduct.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
});

// POST /api/comparison
// Create a new comparison tracker with multiple URLs
router.post('/', async (req, res, next) => {
  try {
    const { productName, urls } = req.body;

    if (!productName) {
      return res.status(400).json({ error: 'Please provide a product name' });
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one product URL' });
    }

    console.log(`[POST /api/comparison] Creating comparison for "${productName}" with ${urls.length} URLs`);

    // Scrape all links sequentially to prevent CPU/memory overload and timeouts
    const scrapedLinks = [];
    for (const url of urls) {
      if (!url || !url.startsWith('http')) {
        scrapedLinks.push({
          url,
          currentPrice: null,
          site: 'invalid',
          isAvailable: false,
          lastCheckedAt: new Date()
        });
        continue;
      }

      try {
        const scraped = await scraper.scrape(url);
        scrapedLinks.push({
          url,
          currentPrice: scraped.price,
          site: scraped.site,
          isAvailable: scraped.price !== null,
          lastCheckedAt: new Date()
        });
      } catch (scrapeErr) {
        console.error(`[POST /api/comparison] Scrape failed for URL: ${url}`, scrapeErr.message);
        scrapedLinks.push({
          url,
          currentPrice: null,
          site: 'unavailable',
          isAvailable: false,
          lastCheckedAt: new Date()
        });
      }
    }

    const newCompareProduct = new ComparisonProduct({
      userId: req.user.id,
      productName,
      links: scrapedLinks
    });

    await newCompareProduct.save();
    res.status(201).json(newCompareProduct);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/comparison/:id
// Delete a comparison product
router.delete('/:id', async (req, res, next) => {
  try {
    const product = await ComparisonProduct.findOne({ _id: req.params.id, userId: req.user.id });
    if (!product) {
      return res.status(404).json({ error: 'Comparison product not found' });
    }

    await ComparisonProduct.deleteOne({ _id: product._id });
    res.status(200).json({ success: true, message: 'Comparison product deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /api/comparison/:id/refresh
// Refresh all links inside a comparison product
router.post('/:id/refresh', async (req, res, next) => {
  try {
    const product = await ComparisonProduct.findOne({ _id: req.params.id, userId: req.user.id });
    if (!product) {
      return res.status(404).json({ error: 'Comparison product not found' });
    }

    console.log(`[POST /api/comparison/:id/refresh] Refreshing comparison "${product.productName}"`);

    // Scrape all links sequentially to prevent CPU/memory overload and timeouts
    const updatedLinks = [];
    for (const link of product.links) {
      try {
        const scraped = await scraper.scrape(link.url);
        updatedLinks.push({
          _id: link._id,
          url: link.url,
          currentPrice: scraped.price,
          site: scraped.site,
          isAvailable: scraped.price !== null,
          lastCheckedAt: new Date()
        });
      } catch (err) {
        console.error(`[POST /api/comparison/refresh] Scrape failed for ${link.url}:`, err.message);
        updatedLinks.push({
          _id: link._id,
          url: link.url,
          currentPrice: null,
          site: link.site || 'unavailable',
          isAvailable: false,
          lastCheckedAt: new Date()
        });
      }
    }

    // Use updateOne to completely bypass Mongoose VersionError and version conflict race conditions
    await ComparisonProduct.updateOne(
      { _id: product._id },
      { $set: { links: updatedLinks } }
    );

    const updatedProduct = await ComparisonProduct.findById(product._id);
    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
