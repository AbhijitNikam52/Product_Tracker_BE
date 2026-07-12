const User = require('../models/User');
const PriceHistory = require('../models/PriceHistory');
const Notification = require('../models/Notification');
const notifier = require('./notifier');

/**
 * Processes a newly scraped price for a tracked item, managing database updates, 
 * historical record creation, and user alerts.
 * 
 * @param {object} item - Mongoose TrackedItem document
 * @param {object} scrapedData - Data extracted from the scraper
 * @returns {Promise<object>} - Updated TrackedItem document
 */
const processPriceUpdate = async (item, scrapedData) => {
  const { price, productName, imageUrl, site, currency } = scrapedData;
  const now = new Date();

  // 1. Update item details
  item.currentPrice = price;
  if (productName) item.productName = productName;
  if (imageUrl) item.imageUrl = imageUrl;
  if (site) item.site = site;
  if (currency) item.currency = currency;
  
  item.isAvailable = price !== null;
  item.lastCheckedAt = now;

  // 2. Save the updated tracked item
  await item.save();

  // 3. Keep exactly 2 records in PriceHistory (previous price & latest price) only when price changes
  if (price !== null) {
    const history = await PriceHistory.find({ itemId: item._id }).sort({ recordedAt: 1 });
    
    if (history.length === 0) {
      // No history exists, create the first record (latest)
      const priceHistoryEntry = new PriceHistory({
        itemId: item._id,
        price: price,
        recordedAt: now
      });
      await priceHistoryEntry.save();
    } else if (history.length === 1) {
      // Only 1 record exists. If new price is different, save it as the second record.
      if (history[0].price !== price) {
        const priceHistoryEntry = new PriceHistory({
          itemId: item._id,
          price: price,
          recordedAt: now
        });
        await priceHistoryEntry.save();
      } else {
        // Price is identical, just update the timestamp of the latest record
        history[0].recordedAt = now;
        await history[0].save();
      }
    } else {
      // 2 or more records exist.
      const latest = history[history.length - 1];
      if (latest.price !== price) {
        // Price changed! Delete older records so the previous latest becomes the oldest (previous price),
        // and add the new price as the new latest.
        const idsToDelete = history.slice(0, history.length - 1).map(h => h._id);
        await PriceHistory.deleteMany({ _id: { $in: idsToDelete } });

        const priceHistoryEntry = new PriceHistory({
          itemId: item._id,
          price: price,
          recordedAt: now
        });
        await priceHistoryEntry.save();
      } else {
        // Price is identical, just update the timestamp of the latest record
        latest.recordedAt = now;
        await latest.save();
      }
    }
  }

  const symbol = currency === 'USD' ? '$' : '₹';

  // 4. Check if price <= target price and alert has not been sent (only when price is available)
  if (price !== null && price <= item.targetPrice && !item.alertSent) {
    try {
      // Find the tracking user
      const user = await User.findById(item.userId);
      if (user) {
        // Send email notification only if user preference is enabled
        if (user.emailNotifications !== false) {
          await notifier.sendEmail(user.email, item, price);
        }

        // Delete any existing notifications for this item to keep only the latest one
        await Notification.deleteMany({ itemId: item._id });

        // Create in-app notification
        const notification = new Notification({
          userId: item.userId,
          itemId: item._id,
          message: `Price dropped to ${symbol}${price} for "${item.productName}"!`
        });
        await notification.save();

        // Update item alert status
        item.alertSent = true;
        await item.save();
        console.log(`Alert sent to ${user.email} for item ${item._id}`);
      }
    } catch (err) {
      console.error('Error sending alert notifications:', err.message);
    }
  } 
  // 5. Reset alert state if price goes back above target (only when price is available)
  else if (price !== null && price > item.targetPrice && item.alertSent) {
    item.alertSent = false;
    await item.save();
    console.log(`Alert flag reset to false for item ${item._id} (price is now ${symbol}${price})`);
  }

  return item;
};

module.exports = {
  process: processPriceUpdate
};
