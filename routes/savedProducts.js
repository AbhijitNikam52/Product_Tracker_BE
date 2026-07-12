const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const SavedProduct = require('../models/SavedProduct');

// GET /api/saved-products - Retrieve all saved products (public/authenticated)
router.get('/', async (req, res, next) => {
  try {
    const products = await SavedProduct.find({}).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
});

// POST /api/saved-products - Save/pin a product (requires login)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { title, imageUrl, price, rating, productUrl, site } = req.body;

    if (!title || !productUrl || !site) {
      return res.status(400).json({ error: 'Missing required product information.' });
    }

    // Check duplicate productUrl
    const existing = await SavedProduct.findOne({ productUrl });
    if (existing) {
      return res.status(200).json(existing);
    }

    const newSaved = new SavedProduct({
      userId: req.user.id,
      title,
      imageUrl,
      price: price !== undefined ? price : null,
      rating: rating || '',
      productUrl,
      site
    });

    await newSaved.save();
    res.status(201).json(newSaved);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/saved-products/:id - Delete a saved product (only owner or admin)
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const product = await SavedProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Saved product not found.' });
    }

    // Check ownership or admin status
    const isOwner = product.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: Only the owner or an admin can delete this saved product.' });
    }

    await SavedProduct.deleteOne({ _id: product._id });
    res.status(200).json({ success: true, message: 'Saved product removed successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
