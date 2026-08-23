const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Coupon = require('../models/Coupon');
const TrackedItem = require('../models/TrackedItem');
const couponService = require('../services/couponService');
const { isValidOffer } = require('../services/scraper');

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

// POST /api/coupons/live
// Receives scraped coupons from Chrome extension, saves/updates them in the database
router.post('/live', async (req, res, next) => {
  try {
    const { store, productUrl, coupons } = req.body;

    if (!store || !coupons || !Array.isArray(coupons)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const savedCoupons = [];

    // Try to find a tracked item for this URL to link them
    let productId = null;
    if (productUrl) {
      let trackedItem = await TrackedItem.findOne({ url: productUrl });
      if (!trackedItem) {
        // Fallback: try matching by product ID from URL query parameters or paths
        const cleanUrlHelper = (u) => {
          try {
            const parsed = new URL(u);
            if (parsed.hostname.includes('amazon.')) {
              const dpMatch = parsed.pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/i);
              if (dpMatch) return dpMatch[2];
            } else if (parsed.hostname.includes('flipkart.com')) {
              const pid = parsed.searchParams.get('pid');
              if (pid) return pid;
            }
          } catch (e) {}
          return null;
        };

        const targetId = cleanUrlHelper(productUrl);
        if (targetId) {
          trackedItem = await TrackedItem.findOne({ url: { $regex: targetId } });
        }
      }
      if (trackedItem) {
        productId = trackedItem._id;
      }
    }

    for (const couponData of coupons) {
      if (!couponData.description) continue;
      
      // Filter out unwanted junk non-offers
      if (!isValidOffer(couponData.description)) continue;

      let existingCoupon;
      if (couponData.code) {
        existingCoupon = await Coupon.findOne({
          store: store.toLowerCase(),
          code: couponData.code.trim(),
          $or: [
            { productUrl: productUrl || '' },
            { productId: productId }
          ]
        });
      } else {
        existingCoupon = await Coupon.findOne({
          store: store.toLowerCase(),
          description: couponData.description.trim(),
          $or: [
            { productUrl: productUrl || '' },
            { productId: productId }
          ]
        });
      }

      if (existingCoupon) {
        // Update existing coupon to ensure it is active
        existingCoupon.description = couponData.description.trim();
        existingCoupon.isActive = true;
        existingCoupon.couponType = couponData.couponType || 'product';
        if (productId) {
          existingCoupon.productId = productId;
        }
        if (productUrl) {
          existingCoupon.productUrl = productUrl;
        }
        if (couponData.discountType) {
          existingCoupon.discountType = couponData.discountType;
        }
        if (couponData.discountValue !== undefined) {
          existingCoupon.discountValue = couponData.discountValue;
        }

        await existingCoupon.save();
        savedCoupons.push(existingCoupon);
      } else {
        // Create new coupon
        const newCoupon = new Coupon({
          code: couponData.code ? couponData.code.trim() : '',
          description: couponData.description.trim(),
          couponType: couponData.couponType || 'product',
          store: store.toLowerCase(),
          productUrl: productUrl || '',
          productId: productId || null,
          isVerified: true,
          source: 'scraped',
          isActive: true,
          discountType: couponData.discountType || 'other',
          discountValue: couponData.discountValue || null
        });

        await newCoupon.save();
        savedCoupons.push(newCoupon);
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${coupons.length} coupons, saved/updated ${savedCoupons.length} coupons.`,
      coupons: savedCoupons
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
