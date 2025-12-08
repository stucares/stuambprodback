const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { authenticateAmbassador } = require('../middleware/auth');

// Ambassador routes
router.get('/settings', authenticateAmbassador, withdrawalController.getSystemSettings);
router.post('/request', authenticateAmbassador, withdrawalController.requestWithdrawal);
router.get('/history', authenticateAmbassador, withdrawalController.getWithdrawalHistory);
router.get('/stats', authenticateAmbassador, withdrawalController.getWithdrawalStats);

module.exports = router;
