const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  itemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedItem', required: true },
  price:      { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now },
});

priceHistorySchema.index({ itemId: 1, recordedAt: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
