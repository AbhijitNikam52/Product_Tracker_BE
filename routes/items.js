const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const TrackedItem = require('../models/TrackedItem');
const PriceHistory = require('../models/PriceHistory');
const Notification = require('../models/Notification');
const scraper = require('../services/scraper');
const scheduler = require('../services/scheduler');

// Apply auth middleware to all item routes
router.use(authMiddleware);

// GET /api/items
// Find all items tracked by the user, attach unread notification counts and initial price, and sort DESC
router.get('/', async (req, res, next) => {
  try {
    const items = await TrackedItem.find({ userId: req.user.id }).sort({ createdAt: -1 });
    
    // Attach unreadNotificationCount and initialPrice to each item
    const itemsWithUnreadCount = await Promise.all(items.map(async (item) => {
      const unreadCount = await Notification.countDocuments({
        userId: req.user.id,
        itemId: item._id,
        isRead: false
      });
      
      const firstHistory = await PriceHistory.findOne({ itemId: item._id }).sort({ recordedAt: 1 });
      const initialPrice = firstHistory ? firstHistory.price : item.currentPrice;

      return {
        ...item.toObject(),
        unreadNotificationCount: unreadCount,
        initialPrice: initialPrice || item.currentPrice
      };
    }));

    res.status(200).json(itemsWithUnreadCount);
  } catch (error) {
    next(error);
  }
});

// POST /api/items
// Handles both scraping preview (when targetPrice === 0) and creating/tracking new products
router.post('/', async (req, res, next) => {
  try {
    const { url, targetPrice, productName, imageUrl, currentPrice, site, currency } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Please provide a valid product URL starting with http/https' });
    }

    console.log(`[POST /api/items] Request for url: ${url}, targetPrice: ${targetPrice}`);

    // Use client-provided pre-scraped details if present, otherwise fall back to scraper
    let scraped;
    if (productName && currentPrice !== undefined) {
      console.log(`[POST /api/items] Using client-provided metadata for: "${productName}"`);
      scraped = {
        productName,
        imageUrl: imageUrl || '',
        price: currentPrice,
        site: site || 'generic',
        currency: currency || 'INR'
      };
    } else {
      try {
        scraped = await scraper.scrape(url);
      } catch (scrapeErr) {
        console.error('[POST /api/items] Scrape error:', scrapeErr.message);
        return res.status(422).json({ error: 'Could not fetch price. Try a different link or verify the website is accessible.' });
      }
    }

    // 1. Preview Mode: if targetPrice is 0 (or not specified), just return scraped data
    if (targetPrice === 0 || targetPrice === undefined) {
      return res.status(200).json(scraped);
    }

    // 2. Track Mode: create the item in the database
    if (isNaN(targetPrice) || targetPrice <= 0) {
      return res.status(400).json({ error: 'Target price must be a number greater than 0' });
    }

    // Check if the user is already tracking this URL to prevent duplicate creation
    const existingItem = await TrackedItem.findOne({ userId: req.user.id, url });
    if (existingItem) {
      existingItem.targetPrice = targetPrice;
      existingItem.currentPrice = scraped.price;
      existingItem.productName = scraped.productName;
      existingItem.imageUrl = scraped.imageUrl;
      existingItem.isAvailable = scraped.price !== null;
      existingItem.lastCheckedAt = new Date();
      
      // Reset alertSent flag if the new target price is below the current price
      if (scraped.price !== null && scraped.price > targetPrice) {
        existingItem.alertSent = false;
      }
      
      await existingItem.save();

      // Keep exactly 2 records in PriceHistory (previous price & latest price) only when price changes
      if (scraped.price !== null) {
        const history = await PriceHistory.find({ itemId: existingItem._id }).sort({ recordedAt: 1 });
        
        if (history.length === 0) {
          const priceHistoryEntry = new PriceHistory({
            itemId: existingItem._id,
            price: scraped.price,
            recordedAt: new Date()
          });
          await priceHistoryEntry.save();
        } else if (history.length === 1) {
          if (history[0].price !== scraped.price) {
            const priceHistoryEntry = new PriceHistory({
              itemId: existingItem._id,
              price: scraped.price,
              recordedAt: new Date()
            });
            await priceHistoryEntry.save();
          } else {
            history[0].recordedAt = new Date();
            await history[0].save();
          }
        } else {
          const latest = history[history.length - 1];
          if (latest.price !== scraped.price) {
            const idsToDelete = history.slice(0, history.length - 1).map(h => h._id);
            await PriceHistory.deleteMany({ _id: { $in: idsToDelete } });

            const priceHistoryEntry = new PriceHistory({
              itemId: existingItem._id,
              price: scraped.price,
              recordedAt: new Date()
            });
            await priceHistoryEntry.save();
          } else {
            latest.recordedAt = new Date();
            await latest.save();
          }
        }
      }

      // Read notifications unread count for existingItem
      const unreadCount = await Notification.countDocuments({
        userId: req.user.id,
        itemId: existingItem._id,
        isRead: false
      });

      return res.status(200).json({
        ...existingItem.toObject(),
        unreadNotificationCount: unreadCount
      });
    }

    const newItem = new TrackedItem({
      userId: req.user.id,
      url,
      productName: scraped.productName,
      imageUrl: scraped.imageUrl,
      targetPrice,
      currentPrice: scraped.price,
      currency: scraped.currency,
      site: scraped.site,
      isAvailable: scraped.price !== null,
      lastCheckedAt: new Date()
    });

    await newItem.save();

    // Create initial entry in PriceHistory (only if price is not null)
    if (scraped.price !== null) {
      const priceHistory = new PriceHistory({
        itemId: newItem._id,
        price: scraped.price,
        recordedAt: new Date()
      });
      await priceHistory.save();
    }

    // Register job in scheduler
    await scheduler.addItemJob(newItem._id);

    // Return the new item with zero unread notifications
    res.status(201).json({
      ...newItem.toObject(),
      unreadNotificationCount: 0
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/items/:id
// Verifies ownership and cleans up the item, its history, and notification logs
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await TrackedItem.findOne({ _id: req.params.id, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // Delete item, history records, and notification logs
    await TrackedItem.deleteOne({ _id: item._id });
    await PriceHistory.deleteMany({ itemId: item._id });
    await Notification.deleteMany({ itemId: item._id });

    // Cancel scheduler cron job
    scheduler.removeItemJob(item._id);

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/items/:id/refresh
// Rate-limits updates to once every 10 minutes, triggers checking, and returns updated info
router.post('/:id/refresh', async (req, res, next) => {
  try {
    const item = await TrackedItem.findOne({ _id: req.params.id, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // Rate limiting: 10 minutes
    if (item.lastCheckedAt) {
      const diffMs = Date.now() - new Date(item.lastCheckedAt).getTime();
      const diffMins = diffMs / 1000 / 60;
      if (diffMins < 10) {
        const remainingMins = Math.ceil(10 - diffMins);
        return res.status(429).json({ 
          error: `Please wait ${remainingMins} minute(s) before refreshing again` 
        });
      }
    }

    // Run check now
    await scheduler.runCheckNow(item._id);

    // Retrieve updated item data
    const updatedItem = await TrackedItem.findById(item._id);
    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      itemId: item._id,
      isRead: false
    });

    const firstHistory = await PriceHistory.findOne({ itemId: item._id }).sort({ recordedAt: 1 });
    const initialPrice = firstHistory ? firstHistory.price : updatedItem.currentPrice;

    res.status(200).json({
      success: true,
      message: 'Refresh triggered',
      item: {
        ...updatedItem.toObject(),
        unreadNotificationCount: unreadCount,
        initialPrice: initialPrice || updatedItem.currentPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/items/:id
// Updates the target price of a tracked item
router.put('/:id', async (req, res, next) => {
  try {
    const { targetPrice } = req.body;
    
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Target price must be a number greater than 0' });
    }

    const item = await TrackedItem.findOne({ _id: req.params.id, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    item.targetPrice = priceNum;
    
    // Reset alertSent if the current price is now above the new target price
    if (item.currentPrice !== null && item.currentPrice > priceNum) {
      item.alertSent = false;
    }
    
    await item.save();

    const firstHistory = await PriceHistory.findOne({ itemId: item._id }).sort({ recordedAt: 1 });
    const initialPrice = firstHistory ? firstHistory.price : item.currentPrice;

    res.status(200).json({
      ...item.toObject(),
      initialPrice: initialPrice || item.currentPrice
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
