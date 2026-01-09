const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const axios = require('axios');

// Ambassador routes
router.post('/register', authController.registerAmbassador);
router.post('/login', authController.loginAmbassador);
router.post('/google', authController.googleLogin);

// Admin routes
router.post('/admin/login', authController.loginAdmin);

// University search proxy (external API doesn't support HTTPS)
router.get('/universities', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.length < 2) {
      return res.json([]);
    }

    const response = await axios.get(
      `http://universities.hipolabs.com/search?name=${encodeURIComponent(name)}`,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    console.error('University API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch universities' });
  }
});

module.exports = router;
