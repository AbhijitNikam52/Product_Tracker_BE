const mongoose = require('mongoose');

const savedProductSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  imageUrl:    { type: String, default: '' },
  price:       { type: Number, default: null },
  rating:      { type: String, default: '' },
  productUrl:  { type: String, required: true, unique: true },
  site:        { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('SavedProduct', savedProductSchema);
