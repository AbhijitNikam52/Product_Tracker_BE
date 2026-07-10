const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const TrackedItem = require('../models/TrackedItem');
const PriceHistory = require('../models/PriceHistory');

// GET /api/prices/:itemId/history
router.get('/:itemId/history', authMiddleware, async (req, res, next) => {
  try {
    const { itemId } = req.params;

    // Verify item belongs to req.user.id
    const item = await TrackedItem.findOne({ _id: itemId, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // Compute date boundary: 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Fetch history
    const history = await PriceHistory.find({
      itemId: item._id,
      recordedAt: { $gte: ninetyDaysAgo }
    }).sort({ recordedAt: 1 });

    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
