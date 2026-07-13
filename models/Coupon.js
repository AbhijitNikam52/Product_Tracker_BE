const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed', 'other'], 
    default: 'other' 
  },
  discountValue: { 
    type: Number, 
    default: null 
  },
  couponType: { 
    type: String, 
    enum: ['store', 'category', 'brand', 'product', 'bank_offer'], 
    required: true 
  },
  store: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true // e.g. 'amazon', 'flipkart'
  },
  category: { 
    type: String, 
    default: '',
    trim: true
  },
  brand: { 
    type: String, 
    default: '',
    trim: true
  },
  productUrl: { 
    type: String, 
    default: '',
    trim: true
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TrackedItem', 
    default: null 
  },
  isVerified: { 
    type: Boolean, 
    default: true 
  },
  expiryDate: { 
    type: Date, 
    default: null 
  },
  source: { 
    type: String, 
    enum: ['scraped', 'admin', 'affiliate'], 
    default: 'admin' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  addedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
