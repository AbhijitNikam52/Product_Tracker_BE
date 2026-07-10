const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Notification = require('../models/Notification');

// Apply auth middleware
router.use(authMiddleware);

// GET /api/notifications
// Retrieves user's latest 20 notifications sorted by newest first
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/mark-read
// Marks all notifications of the user as read
router.patch('/mark-read', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
