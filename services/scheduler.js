const cron = require('node-cron');
const TrackedItem = require('../models/TrackedItem');
const scraper = require('./scraper');
const priceEngine = require('./priceEngine');

// Map to store scheduled cron tasks, keyed by item ID string
const activeJobs = new Map();

/**
 * Performs a price check for a specific item
 * @param {string} itemId 
 */
const performCheck = async (itemId) => {
  console.log(`[Scheduler] Starting check for item: ${itemId}`);
  let item;
  try {
    item = await TrackedItem.findById(itemId);
    if (!item) {
      console.log(`[Scheduler] Check aborted: Item ${itemId} not found in DB`);
      removeItemJob(itemId); // clean up if item was deleted from DB
      return;
    }

    const scrapedData = await scraper.scrape(item.url);
    await priceEngine.process(item, scrapedData);

    // Increment check hit count
    item.checkCount = (item.checkCount || 0) + 1;
    await item.save();

    console.log(`[Scheduler] Check successful for item: ${itemId} (${item.productName})`);
  } catch (error) {
    console.error(`[Scheduler] Check failed for item: ${itemId}. Error:`, error.message);
    if (item) {
      try {
        item.isAvailable = false;
        item.lastCheckedAt = new Date();
        item.checkCount = (item.checkCount || 0) + 1;
        await item.save();
      } catch (saveErr) {
        console.error(`[Scheduler] Failed to update availability status for item: ${itemId}`, saveErr.message);
      }
    }
  }
};

/**
 * Initializes and starts the scheduler on application boot.
 * Schedules all existing TrackedItems.
 */
const startScheduler = async () => {
  try {
    console.log('[Scheduler] Initializing price tracker jobs...');
    const items = await TrackedItem.find({});
    console.log(`[Scheduler] Found ${items.length} items to schedule.`);
    
    for (const item of items) {
      scheduleItemCron(item._id.toString());
    }
    console.log('[Scheduler] All jobs scheduled successfully.');
  } catch (error) {
    console.error('[Scheduler] Error starting scheduler:', error.message);
  }
};

/**
 * Helper to schedule a 1-minute cron job in-memory
 * @param {string} itemIdStr 
 */
const scheduleItemCron = (itemIdStr) => {
  // If job already exists, stop and remove it first
  if (activeJobs.has(itemIdStr)) {
    removeItemJob(itemIdStr);
  }

  // Schedule every minute: '* * * * *'
  const task = cron.schedule('* * * * *', async () => {
    await performCheck(itemIdStr);
  });

  activeJobs.set(itemIdStr, task);
  console.log(`[Scheduler] Scheduled cron job (1m) for item: ${itemIdStr}`);
};

/**
 * Adds and schedules a new item job. Also runs an immediate check.
 * @param {string} itemId 
 */
const addItemJob = async (itemId) => {
  const itemIdStr = itemId.toString();
  scheduleItemCron(itemIdStr);
  
  // Run check immediately in the background
  performCheck(itemIdStr).catch(err => {
    console.error(`[Scheduler] Background initial check failed for ${itemIdStr}:`, err.message);
  });
};

/**
 * Stops and removes a scheduled job from the registry
 * @param {string} itemId 
 */
const removeItemJob = (itemId) => {
  const itemIdStr = itemId.toString();
  if (activeJobs.has(itemIdStr)) {
    const task = activeJobs.get(itemIdStr);
    task.stop();
    activeJobs.delete(itemIdStr);
    console.log(`[Scheduler] Stopped and removed cron job for item: ${itemIdStr}`);
  }
};

/**
 * Manually triggers a check immediately (for manual refresh)
 * @param {string} itemId 
 */
const runCheckNow = async (itemId) => {
  const itemIdStr = itemId.toString();
  // Runs performCheck and waits for it to finish so routes can return updated data
  await performCheck(itemIdStr);
};

module.exports = {
  startScheduler,
  addItemJob,
  removeItemJob,
  runCheckNow
};
