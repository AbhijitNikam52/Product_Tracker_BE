const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const searchService = require('../services/productSearchService');

// Apply auth middleware to protect search route
router.use(authMiddleware);

// GET /api/search?q=your+product+query
router.get('/', async (req, res, next) => {
  try {
    const query = req.query.q;

    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Please enter a product query.' });
    }

    console.log(`[GET /api/search] Received search request for: "${query}" from user: ${req.user.id}`);
    
    const results = await searchService.searchAll(query);
    res.status(200).json(results);
  } catch (error) {
    console.error(`[GET /api/search] Error during search execution:`, error.message);
    next(error);
  }
});

module.exports = router;
