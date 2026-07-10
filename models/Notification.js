const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedItem', required: true },
  message:  { type: String, required: true },
  isRead:   { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
