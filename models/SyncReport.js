const mongoose = require('mongoose');

const syncLogLineSchema = new mongoose.Schema({
  itemId:          { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedItem', default: null },
  productName:     { type: String, default: '' },
  productUrl:      { type: String, default: '' },
  site:            { type: String, default: '' },
  oldPrice:        { type: Number, default: null },
  newPrice:        { type: Number, default: null },
  targetPrice:     { type: Number, default: null },
  oldAvailable:    { type: Boolean, default: true },
  newAvailable:    { type: Boolean, default: true },
  status:          { type: String, enum: ['updated', 'unchanged', 'unavailable', 'error'], required: true },
  changeDetails:   { type: String, required: true },
  logType:         { type: String, enum: ['PRICE_DROP', 'PRICE_RISE', 'UNCHANGED', 'UNAVAILABLE', 'ERROR'], default: 'UNCHANGED' },
  timestamp:       { type: Date, default: Date.now }
}, { _id: true });

const syncReportSchema = new mongoose.Schema({
  triggeredBy:     { type: String, default: 'Admin' },
  status:          { type: String, enum: ['running', 'completed', 'failed'], default: 'completed' },
  startedAt:       { type: Date, default: Date.now },
  completedAt:     { type: Date, default: Date.now },
  durationMs:      { type: Number, default: 0 },
  summary: {
    totalProducts:     { type: Number, default: 0 },
    updatedCount:      { type: Number, default: 0 },
    unchangedCount:    { type: Number, default: 0 },
    unavailableCount:  { type: Number, default: 0 },
    failedCount:       { type: Number, default: 0 }
  },
  logs: [syncLogLineSchema]
}, { timestamps: true });

module.exports = mongoose.model('SyncReport', syncReportSchema);
