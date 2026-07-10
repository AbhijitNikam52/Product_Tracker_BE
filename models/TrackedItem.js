const mongoose = require('mongoose');

const trackedItemSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url:            { type: String, required: true },
  productName:    { type: String, default: '' },
  imageUrl:       { type: String, default: '' },
  targetPrice:    { type: Number, required: true },
  currentPrice:   { type: Number, default: null },
  currency:       { type: String, default: 'INR' },
  site:           { type: String, default: '' },       // 'amazon', 'flipkart', 'myntra', etc.
  isAvailable:    { type: Boolean, default: true },
  alertSent:      { type: Boolean, default: false },
  lastCheckedAt:  { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('TrackedItem', trackedItemSchema);
