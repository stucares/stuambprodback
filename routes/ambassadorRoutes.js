const express = require('express');
const router = express.Router();
const ambassadorController = require('../controllers/ambassadorController');
const { authenticateAmbassador } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateAmbassador);

router.get('/profile', ambassadorController.getProfile);
router.put('/profile', ambassadorController.updateProfile);
router.get('/stats', ambassadorController.getStats);
router.get('/tasks', ambassadorController.getTasks);
router.get('/referrals', ambassadorController.getReferrals);

module.exports = router;
