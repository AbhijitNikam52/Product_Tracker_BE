const Coupon = require('../models/Coupon');

/**
 * Updates scraped coupons for a specific product.
 * Removes previously scraped coupons for this productUrl and replaces them with new ones.
 * 
 * @param {string} productUrl 
 * @param {string} productId 
 * @param {string} store 
 * @param {Array} couponsList 
 */
const updateScrapedCoupons = async (productUrl, productId, store, couponsList) => {
  try {
    if (!productUrl) return;

    // Delete existing scraped coupons for this productUrl
    await Coupon.deleteMany({
      productUrl,
      source: 'scraped'
    });

    if (couponsList && couponsList.length > 0) {
      const docs = couponsList.map(c => ({
        code: c.code || '',
        description: c.description,
        couponType: c.couponType || 'product',
        store: store || 'generic',
        productUrl,
        productId: productId || null,
        isVerified: true,
        source: 'scraped',
        isActive: true
      }));
      await Coupon.insertMany(docs);
      console.log(`[CouponService] Saved ${docs.length} scraped coupons for product: ${productUrl}`);
    }
  } catch (error) {
    console.error('[CouponService] Error updating scraped coupons:', error.message);
  }
};

/**
 * Retrieves all relevant coupons for a given product details.
 * This includes:
 * 1. Product-level coupons matching the productUrl or productId
 * 2. Brand-level coupons matching the brand (case-insensitive)
 * 3. Category-level coupons matching the category (case-insensitive)
 * 4. Store-level coupons matching the store
 * 5. Bank offers matching the store
 * 
 * @param {object} params
 * @param {string} params.productUrl
 * @param {string} params.store
 * @param {string} params.category
 * @param {string} params.brand
 * @param {string} params.productId
 * @returns {Promise<Array>}
 */
const getCouponsForProduct = async ({ productUrl, store, category, brand, productId }) => {
  try {
    const cleanStore = (store || '').toLowerCase();
    const query = {
      isActive: true,
      $or: [
        // Store-wide coupons
        { couponType: 'store', store: cleanStore },
        // Bank offers for this store
        { couponType: 'bank_offer', store: cleanStore }
      ]
    };

    if (productUrl) {
      query.$or.push({ couponType: 'product', productUrl });
    }

    if (productId) {
      query.$or.push({ couponType: 'product', productId });
    }

    if (brand) {
      query.$or.push({ 
        couponType: 'brand', 
        store: cleanStore, 
        brand: { $regex: new RegExp(`^${brand.trim()}$`, 'i') } 
      });
    }

    if (category) {
      query.$or.push({ 
        couponType: 'category', 
        store: cleanStore, 
        category: { $regex: new RegExp(`^${category.trim()}$`, 'i') } 
      });
    }

    const coupons = await Coupon.find(query).sort({ isVerified: -1, createdAt: -1 });
    return coupons;
  } catch (error) {
    console.error('[CouponService] Error getting coupons for product:', error.message);
    return [];
  }
};

/**
 * Simulates syncing coupons from an affiliate feed.
 * Populates the database with some realistic store and category level affiliate coupons.
 */
const syncAffiliateCoupons = async () => {
  try {
    // Check if we already synced or created these affiliate coupons to avoid endless duplicates
    const existingCount = await Coupon.countDocuments({ source: 'affiliate' });
    if (existingCount > 0) {
      // Just refresh/return existing ones or insert any missing ones.
      // For this mock sync, we'll delete and re-insert to simulate a fresh feed sync.
      await Coupon.deleteMany({ source: 'affiliate' });
    }

    const affiliateCoupons = [
      // Amazon
      {
        code: 'AMZNEW150',
        description: 'Get Flat ₹150 Cashback on your first shopping order of ₹1000 or more.',
        discountType: 'fixed',
        discountValue: 150,
        couponType: 'store',
        store: 'amazon',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      {
        code: 'AMZELEC5',
        description: 'Additional 5% discount on Select Bose and Sony Audio Accessories.',
        discountType: 'percentage',
        discountValue: 5,
        couponType: 'brand',
        store: 'amazon',
        brand: 'Sony',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      // Flipkart
      {
        code: 'FKFASHION20',
        description: 'Extra 20% discount on clothing, shoes, and lifestyle brands.',
        discountType: 'percentage',
        discountValue: 20,
        couponType: 'category',
        store: 'flipkart',
        category: 'Fashion',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      {
        code: 'FKHDFC10',
        description: '10% Instant Discount on HDFC Credit Cards. Min transaction value ₹5000.',
        discountType: 'percentage',
        discountValue: 10,
        couponType: 'bank_offer',
        store: 'flipkart',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      // Myntra
      {
        code: 'MYNTRA500',
        description: 'Flat ₹500 discount on a minimum purchase of ₹2999 on premium styles.',
        discountType: 'fixed',
        discountValue: 500,
        couponType: 'store',
        store: 'myntra',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      {
        code: 'NIKE25',
        description: 'Save 25% on Nike Shoes and Running Apparel.',
        discountType: 'percentage',
        discountValue: 25,
        couponType: 'brand',
        store: 'myntra',
        brand: 'Nike',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      // Ajio
      {
        code: 'AJIOWELCOME',
        description: 'Flat ₹300 discount on your first order of ₹1490 or above.',
        discountType: 'fixed',
        discountValue: 300,
        couponType: 'store',
        store: 'ajio',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      },
      {
        code: 'AJIOFESTIVE',
        description: 'Up to 30% off on ethnic and festive wear collection.',
        discountType: 'percentage',
        discountValue: 30,
        couponType: 'category',
        store: 'ajio',
        category: 'Fashion',
        isVerified: true,
        source: 'affiliate',
        isActive: true
      }
    ];

    await Coupon.insertMany(affiliateCoupons);
    console.log('[CouponService] Affiliate coupons feed synced successfully.');
    return { success: true, count: affiliateCoupons.length };
  } catch (error) {
    console.error('[CouponService] Error syncing affiliate coupons:', error.message);
    throw error;
  }
};

module.exports = {
  updateScrapedCoupons,
  getCouponsForProduct,
  syncAffiliateCoupons
};
