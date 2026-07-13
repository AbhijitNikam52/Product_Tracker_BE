const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Coupon = require('../models/Coupon');
const couponService = require('../services/couponService');

// GET /api/coupons
// Retrieves all active coupons (with isActive: true) sorted by verified status and date
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true }).sort({ isVerified: -1, createdAt: -1 });
    res.status(200).json(coupons);
  } catch (error) {
    next(error);
  }
});

// GET /api/coupons/product
// Retrieves relevant coupons (product, store, category, brand, bank offers) for a specific product URL/store
router.get('/product', authMiddleware, async (req, res, next) => {
  try {
    const { url, store, category, brand, productId } = req.query;

    if (!url && !store && !productId) {
      return res.status(400).json({ error: 'Please provide url, store, or productId' });
    }

    const coupons = await couponService.getCouponsForProduct({
      productUrl: url,
      store,
      category,
      brand,
      productId
    });

    res.status(200).json(coupons);
  } catch (error) {
    next(error);
  }
});

// GET /api/coupons/store/:store
// Public route (accessible by Chrome Extension without explicit JWT auth for simplicity)
// Returns all active store-wide and bank-offer coupons for a given e-commerce store
router.get('/store/:store', async (req, res, next) => {
  try {
    const storeName = req.params.store.toLowerCase();

    // Query active store-level coupons and bank offers for this store
    const coupons = await Coupon.find({
      store: storeName,
      isActive: true,
      couponType: { $in: ['store', 'bank_offer', 'category', 'brand'] }
    }).sort({ isVerified: -1, createdAt: -1 });

    res.status(200).json(coupons);
  } catch (error) {
    next(error);
  }
});

// POST /api/coupons/:id/verify
// Allows authenticated users to mark a coupon code as verified/unverified (Phase 3)
router.post('/:id/verify', authMiddleware, async (req, res, next) => {
  try {
    const { isVerified } = req.body;
    if (isVerified === undefined) {
      return res.status(400).json({ error: 'Please specify if the coupon code isVerified (true/false)' });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    coupon.isVerified = !!isVerified;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon verification status updated to ${coupon.isVerified}`,
      coupon
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
