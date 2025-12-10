const express = require('express');
const router = express.Router();
const premiumController = require('../controllers/premiumController');
const { authenticateAdmin } = require('../middleware/auth');

// Public routes (no auth required)
// Premium settings (read-only for users to see pricing)
router.get('/settings', premiumController.getPremiumSettings);

// Admin-only routes
router.use(authenticateAdmin);

// Premium members management
router.get('/members', premiumController.getPremiumMembers);
router.put('/members/:ambassadorId/revoke', premiumController.revokePremium);
router.put('/members/:ambassadorId/extend', premiumController.extendPremium);
router.put('/members/:ambassadorId/meeting', premiumController.updateMeeting);

// Premium settings update (admin only)
router.put('/settings', premiumController.updatePremiumSettings);

module.exports = router;
