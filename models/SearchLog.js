const mongoose = require('mongoose');

const searchLogSchema = new mongoose.Schema({
  query:     { type: String, required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SearchLog', searchLogSchema);
