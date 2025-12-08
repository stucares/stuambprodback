const express = require('express');
const router = express.Router();
const premiumController = require('../controllers/premiumController');
const { authenticateAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateAdmin);

// Premium members management
router.get('/members', premiumController.getPremiumMembers);
router.put('/members/:ambassadorId/revoke', premiumController.revokePremium);
router.put('/members/:ambassadorId/extend', premiumController.extendPremium);
router.put('/members/:ambassadorId/meeting', premiumController.updateMeeting);

// Premium settings
router.get('/settings', premiumController.getPremiumSettings);
router.put('/settings', premiumController.updatePremiumSettings);

module.exports = router;
