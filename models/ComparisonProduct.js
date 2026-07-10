const mongoose = require('mongoose');

const comparisonProductSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productName: { type: String, required: true },
  links: [{
    url:           { type: String, required: true },
    currentPrice:  { type: Number, default: null },
    site:          { type: String, default: '' },
    isAvailable:   { type: Boolean, default: true },
    lastCheckedAt: { type: Date, default: null }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ComparisonProduct', comparisonProductSchema);
