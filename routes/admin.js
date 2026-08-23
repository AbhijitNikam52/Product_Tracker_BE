const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');

// Middlewares
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Models
const User = require('../models/User');
const TrackedItem = require('../models/TrackedItem');
const PriceHistory = require('../models/PriceHistory');
const Notification = require('../models/Notification');
const SearchLog = require('../models/SearchLog');
const ComparisonProduct = require('../models/ComparisonProduct');
const SavedProduct = require('../models/SavedProduct');
const SyncReport = require('../models/SyncReport');

// Services
const scheduler = require('../services/scheduler');
const scraper = require('../services/scraper');
const priceEngine = require('../services/priceEngine');

// Protect all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/dashboard
// System stats, overview metrics, categories breakdown, and top searches analytics
router.get('/dashboard', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalItems = await TrackedItem.countDocuments();
    const activeItems = await TrackedItem.countDocuments({ isAvailable: true });
    const alertsTriggered = await TrackedItem.countDocuments({ alertSent: true });
    const totalPriceHistories = await PriceHistory.countDocuments();
    const totalNotifications = await Notification.countDocuments();
    const totalComparisons = await ComparisonProduct.countDocuments();
    const totalSavedProducts = await SavedProduct.countDocuments();

    // Retailer breakdown
    const siteBreakdown = await TrackedItem.aggregate([
      { $group: { _id: '$site', count: { $sum: 1 } } }
    ]);

    // Format site breakdown as an object: { amazon: 12, flipkart: 5, ... }
    const siteStats = {};
    siteBreakdown.forEach(item => {
      const siteName = item._id || 'unknown';
      siteStats[siteName] = item.count;
    });

    // Dynamic Category classification by product names
    const allTrackedItems = await TrackedItem.find({}, 'productName');
    const categoryStats = {
      Electronics: 0,
      Fashion: 0,
      Books: 0,
      'Home & Kitchen': 0,
      'General / Other': 0
    };

    allTrackedItems.forEach(item => {
      const name = (item.productName || '').toLowerCase();
      if (name.includes('phone') || name.includes('iphone') || name.includes('macbook') || name.includes('laptop') || name.includes('mouse') || name.includes('sony') || name.includes('headphones') || name.includes('earbuds') || name.includes('watch') || name.includes('soundbar') || name.includes('tv') || name.includes('charger') || name.includes('ipad') || name.includes('tablet') || name.includes('lens') || name.includes('camera') || name.includes('processor') || name.includes('ssd') || name.includes('monitor')) {
        categoryStats.Electronics++;
      } else if (name.includes('shirt') || name.includes('jean') || name.includes('dress') || name.includes('shoe') || name.includes('bag') || name.includes('t-shirt') || name.includes('kurta') || name.includes('jeans') || name.includes('saree') || name.includes('jacket') || name.includes('pant') || name.includes('sneaker') || name.includes('heel') || name.includes('watch') || name.includes('frock')) {
        categoryStats.Fashion++;
      } else if (name.includes('book') || name.includes('novel') || name.includes('encyclopedia') || name.includes('textbook') || name.includes('literature') || name.includes('paperback') || name.includes('hardcover')) {
        categoryStats.Books++;
      } else if (name.includes('cooker') || name.includes('bottle') || name.includes('spoon') || name.includes('sofa') || name.includes('bed') || name.includes('vacuum') || name.includes('fridge') || name.includes('oven') || name.includes('plate') || name.includes('furniture') || name.includes('table') || name.includes('chair') || name.includes('mixer') || name.includes('grinder') || name.includes('curtain') || name.includes('pillow')) {
        categoryStats['Home & Kitchen']++;
      } else {
        categoryStats['General / Other']++;
      }
    });

    // Top searches from SearchLog collection
    const topSearches = await SearchLog.aggregate([
      { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const topSearchesFormatted = topSearches.map(ts => ({
      query: ts._id,
      count: ts.count
    }));

    // System stats
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const systemInfo = {
      platform: os.platform(),
      uptime: os.uptime(),
      cpuCount: os.cpus().length,
      memoryUsage: {
        usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        percentage: ((usedMem / totalMem) * 100).toFixed(1)
      },
      dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    };

    res.status(200).json({
      metrics: {
        totalUsers,
        totalItems,
        activeItems,
        alertsTriggered,
        totalPriceHistories,
        totalNotifications,
        totalComparisons,
        totalSavedProducts
      },
      siteStats,
      categoryStats,
      topSearches: topSearchesFormatted,
      systemInfo
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users
// List all users with their item count
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const itemCount = await TrackedItem.countDocuments({ userId: user._id });
      const compareCount = await ComparisonProduct.countDocuments({ userId: user._id });
      return {
        _id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        emailNotifications: user.emailNotifications,
        createdAt: user.createdAt,
        itemCount,
        compareCount
      };
    }));

    res.status(200).json(usersWithStats);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/users/:id/role
// Toggle or set user role
router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.user.id === req.params.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote yourself.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({ 
      message: `User role updated to ${role} successfully`, 
      user: { _id: user._id, email: user.email, role: user.role } 
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id
// Delete user and cascade delete trackers, comparisons, histories, and notifications
router.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (req.user.id === userId) {
      return res.status(400).json({ error: 'You cannot delete your own account from the Admin Panel.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const items = await TrackedItem.find({ userId });
    for (const item of items) {
      scheduler.removeItemJob(item._id);
    }

    await TrackedItem.deleteMany({ userId });
    await ComparisonProduct.deleteMany({ userId });
    await PriceHistory.deleteMany({ itemId: { $in: items.map(i => i._id) } });
    await Notification.deleteMany({ userId });
    await SearchLog.deleteMany({ userId });
    await User.deleteOne({ _id: userId });

    res.status(200).json({ success: true, message: 'User and all associated data deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/items
// List all items tracked globally, with owner email populated and checkCount
router.get('/items', async (req, res, next) => {
  try {
    const items = await TrackedItem.find({}).sort({ createdAt: -1 });

    const itemsWithOwners = await Promise.all(items.map(async (item) => {
      const owner = await User.findById(item.userId).select('email name');
      
      const firstHistory = await PriceHistory.findOne({ itemId: item._id }).sort({ recordedAt: 1 });
      const initialPrice = firstHistory ? firstHistory.price : item.currentPrice;

      return {
        ...item.toObject(),
        ownerEmail: owner ? owner.email : 'Unknown User',
        ownerName: owner ? owner.name : '',
        initialPrice: initialPrice || item.currentPrice
      };
    }));

    res.status(200).json(itemsWithOwners);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/items/:id
router.delete('/items/:id', async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const item = await TrackedItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await TrackedItem.deleteOne({ _id: itemId });
    await PriceHistory.deleteMany({ itemId });
    await Notification.deleteMany({ itemId });

    scheduler.removeItemJob(itemId);

    res.status(200).json({ success: true, message: 'Item deleted globally' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/items/:id/refresh
router.post('/items/:id/refresh', async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const item = await TrackedItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await scheduler.runCheckNow(itemId);

    const updatedItem = await TrackedItem.findById(itemId);
    const owner = await User.findById(updatedItem.userId).select('email name');
    
    const firstHistory = await PriceHistory.findOne({ itemId: updatedItem._id }).sort({ recordedAt: 1 });
    const initialPrice = firstHistory ? firstHistory.price : updatedItem.currentPrice;

    res.status(200).json({
      success: true,
      message: 'Item refreshed successfully',
      item: {
        ...updatedItem.toObject(),
        ownerEmail: owner ? owner.email : 'Unknown User',
        ownerName: owner ? owner.name : '',
        initialPrice: initialPrice || updatedItem.currentPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/comparisons
// List all compared products globally, populated with owner email
router.get('/comparisons', async (req, res, next) => {
  try {
    const comparisons = await ComparisonProduct.find({}).sort({ createdAt: -1 });
    
    const comparisonsWithOwners = await Promise.all(comparisons.map(async (comp) => {
      const owner = await User.findById(comp.userId).select('email name');
      return {
        ...comp.toObject(),
        ownerEmail: owner ? owner.email : 'Unknown User',
        ownerName: owner ? owner.name : ''
      };
    }));

    res.status(200).json(comparisonsWithOwners);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/comparisons/:id
// Delete a comparison product globally
router.delete('/comparisons/:id', async (req, res, next) => {
  try {
    const compId = req.params.id;
    const comparison = await ComparisonProduct.findById(compId);
    if (!comparison) {
      return res.status(404).json({ error: 'Comparison product not found' });
    }

    await ComparisonProduct.deleteOne({ _id: compId });
    res.status(200).json({ success: true, message: 'Comparison product deleted globally.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/comparisons/:id/refresh
// Force immediate refresh of all links inside a comparison product
router.post('/comparisons/:id/refresh', async (req, res, next) => {
  try {
    const compId = req.params.id;
    const product = await ComparisonProduct.findById(compId);
    if (!product) {
      return res.status(404).json({ error: 'Comparison product not found' });
    }

    console.log(`[Admin API] Force refreshing comparison "${product.productName}"`);

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
        console.error(`[Admin API/Comparison Refresh] Scrape failed for ${link.url}:`, err.message);
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

    await ComparisonProduct.updateOne(
      { _id: product._id },
      { $set: { links: updatedLinks } }
    );

    const updatedProduct = await ComparisonProduct.findById(product._id);
    const owner = await User.findById(updatedProduct.userId).select('email name');

    res.status(200).json({
      success: true,
      message: 'Comparison product refreshed successfully.',
      comparison: {
        ...updatedProduct.toObject(),
        ownerEmail: owner ? owner.email : 'Unknown User',
        ownerName: owner ? owner.name : ''
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/scheduler/trigger
// Manually trigger checks for ALL tracked products concurrently in the background
router.post('/scheduler/trigger', async (req, res, next) => {
  try {
    const items = await TrackedItem.find({});
    
    console.log(`[Admin API] Manual scheduler check triggered for all ${items.length} items.`);
    
    items.forEach((item) => {
      scheduler.runCheckNow(item._id).catch((err) => {
        console.error(`[Admin API] Error in background check for item ${item._id}:`, err.message);
      });
    });

    res.status(200).json({
      success: true,
      message: `Manual checks initiated in background for all ${items.length} products.`
    });
  } catch (error) {
    next(error);
  }
});
// POST /api/admin/sync-all
// Runs live web scraping across all tracked products in the database, updates changed prices, and generates an audit report
router.post('/sync-all', async (req, res, next) => {
  const startTime = Date.now();
  const startedAt = new Date();

  try {
    const items = await TrackedItem.find({});
    const triggeredBy = req.user?.email ? `Admin (${req.user.email})` : 'Admin';

    const logs = [];
    let updatedCount = 0;
    let unchangedCount = 0;
    let unavailableCount = 0;
    let failedCount = 0;

    console.log(`[Sync Engine] Admin initiated live bulk sync for ${items.length} products.`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const oldPrice = item.currentPrice;
      const oldAvailable = item.isAvailable;
      const symbol = item.currency === 'USD' ? '$' : '₹';

      try {
        const scrapedData = await scraper.scrape(item.url);
        const newPrice = scrapedData.price;
        const isNowAvailable = newPrice !== null;

        let status = 'unchanged';
        let logType = 'UNCHANGED';
        let changeDetails = '';

        if (newPrice === null) {
          status = 'unavailable';
          logType = 'UNAVAILABLE';
          changeDetails = `OUT OF STOCK: Product page returned null price or is currently unavailable.`;
          unavailableCount++;
        } else if (oldPrice === null && newPrice !== null) {
          status = 'updated';
          logType = 'PRICE_DROP';
          changeDetails = `BACK IN STOCK: Now available at ${symbol}${newPrice.toLocaleString('en-IN')}.`;
          updatedCount++;
        } else if (oldPrice !== null && newPrice !== oldPrice) {
          status = 'updated';
          if (newPrice < oldPrice) {
            logType = 'PRICE_DROP';
            changeDetails = `PRICE DROPPED: Reduced by ${symbol}${(oldPrice - newPrice).toLocaleString('en-IN')} (${symbol}${oldPrice.toLocaleString('en-IN')} ➔ ${symbol}${newPrice.toLocaleString('en-IN')}).`;
          } else {
            logType = 'PRICE_RISE';
            changeDetails = `PRICE INCREASED: Rose by ${symbol}${(newPrice - oldPrice).toLocaleString('en-IN')} (${symbol}${oldPrice.toLocaleString('en-IN')} ➔ ${symbol}${newPrice.toLocaleString('en-IN')}).`;
          }
          updatedCount++;
        } else {
          status = 'unchanged';
          logType = 'UNCHANGED';
          changeDetails = `UNCHANGED: Price verified at ${symbol}${newPrice.toLocaleString('en-IN')}.`;
          unchangedCount++;
        }

        // Apply price engine updates to database (updates currentPrice, isAvailable, PriceHistory, alerts)
        await priceEngine.process(item, scrapedData);

        logs.push({
          itemId: item._id,
          productName: item.productName || scrapedData.productName || 'Tracked Product',
          productUrl: item.url,
          site: item.site || scrapedData.site || 'generic',
          oldPrice,
          newPrice,
          targetPrice: item.targetPrice,
          oldAvailable,
          newAvailable: isNowAvailable,
          status,
          logType,
          changeDetails,
          timestamp: new Date()
        });

      } catch (err) {
        failedCount++;
        console.error(`[Sync Engine] Error scraping item ${item._id} (${item.productName}):`, err.message);
        logs.push({
          itemId: item._id,
          productName: item.productName || 'Tracked Product',
          productUrl: item.url,
          site: item.site || 'generic',
          oldPrice,
          newPrice: oldPrice,
          targetPrice: item.targetPrice,
          oldAvailable,
          newAvailable: false,
          status: 'error',
          logType: 'ERROR',
          changeDetails: `SCRAPE FAILED: ${err.message || 'Page load error / anti-bot block.'}`,
          timestamp: new Date()
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const completedAt = new Date();

    const syncReport = new SyncReport({
      triggeredBy,
      status: 'completed',
      startedAt,
      completedAt,
      durationMs,
      summary: {
        totalProducts: items.length,
        updatedCount,
        unchangedCount,
        unavailableCount,
        failedCount
      },
      logs
    });

    await syncReport.save();

    res.status(200).json({
      success: true,
      message: `Live sync completed in ${(durationMs / 1000).toFixed(1)}s. ${updatedCount} products updated, ${unchangedCount} unchanged, ${unavailableCount} unavailable, ${failedCount} errors.`,
      report: syncReport
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/sync-reports
// List all sync execution reports sorted by date
router.get('/sync-reports', async (req, res, next) => {
  try {
    const reports = await SyncReport.find({}, { logs: 0 }).sort({ startedAt: -1 }).limit(50);
    res.status(200).json(reports);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/sync-reports/:id
// Get full details and logs of a specific sync report
router.get('/sync-reports/:id', async (req, res, next) => {
  try {
    const report = await SyncReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Sync report not found' });
    }
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/sync-reports/:id
// Delete a specific sync report
router.delete('/sync-reports/:id', async (req, res, next) => {
  try {
    const report = await SyncReport.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Sync report not found' });
    }
    res.status(200).json({ success: true, message: 'Sync report deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
