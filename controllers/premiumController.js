const { Ambassador, SystemSettings } = require('../models');
const { Op } = require('sequelize');

// Get all premium members
exports.getPremiumMembers = async (req, res) => {
  try {
    const members = await Ambassador.findAll({
      where: {
        isPremium: true
      },
      attributes: { exclude: ['password'] },
      order: [['premiumExpiresAt', 'DESC']]
    });

    res.json({
      success: true,
      members
    });
  } catch (error) {
    console.error('Get premium members error:', error);
    res.status(500).json({ message: 'Failed to fetch premium members' });
  }
};

// Revoke premium access
exports.revokePremium = async (req, res) => {
  try {
    const { ambassadorId } = req.params;

    const ambassador = await Ambassador.findByPk(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    await ambassador.update({
      isPremium: false,
      premiumExpiresAt: new Date()
    });

    res.json({
      success: true,
      message: 'Premium access revoked'
    });
  } catch (error) {
    console.error('Revoke premium error:', error);
    res.status(500).json({ message: 'Failed to revoke premium' });
  }
};

// Extend premium subscription
exports.extendPremium = async (req, res) => {
  try {
    const { ambassadorId } = req.params;
    const { months } = req.body;

    const ambassador = await Ambassador.findByPk(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    // Calculate new expiry date
    const currentExpiry = new Date(ambassador.premiumExpiresAt);
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;
    
    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));

    await ambassador.update({
      isPremium: true,
      premiumExpiresAt: newExpiry
    });

    res.json({
      success: true,
      message: `Premium extended by ${months} month(s)`,
      newExpiryDate: newExpiry
    });
  } catch (error) {
    console.error('Extend premium error:', error);
    res.status(500).json({ message: 'Failed to extend premium' });
  }
};

// Update meeting details
exports.updateMeeting = async (req, res) => {
  try {
    const { ambassadorId } = req.params;
    const { meetingDate, meetingLink, meetingScheduled } = req.body;

    const ambassador = await Ambassador.findByPk(ambassadorId);
    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    await ambassador.update({
      meetingDate: meetingDate ? new Date(meetingDate) : null,
      meetingLink: meetingLink || null,
      meetingScheduled: meetingScheduled !== undefined ? meetingScheduled : true
    });

    res.json({
      success: true,
      message: 'Meeting details updated'
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
};

// Get premium settings
exports.getPremiumSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ where: { key: 'premium_settings' } });
    
    if (!settings) {
      // Create default settings
      const defaultSettings = {
        premiumPrice: 19,
        lifetimePrice: 999,
        pointsMultiplier: 2,
        dailyTasksEnabled: true,
        welcomeKitEnabled: true,
        meetingDaysAfterPayment: 2,
        premiumDurationMonths: 1,
        cashfreeEnabled: process.env.NODE_ENV === 'production'
      };

      settings = await SystemSettings.create({
        key: 'premium_settings',
        value: JSON.stringify(defaultSettings)
      });
    }

    res.json({
      success: true,
      settings: JSON.parse(settings.value)
    });
  } catch (error) {
    console.error('Get premium settings error:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Update premium settings
exports.updatePremiumSettings = async (req, res) => {
  try {
    const newSettings = req.body;

    let settings = await SystemSettings.findOne({ where: { key: 'premium_settings' } });
    
    if (!settings) {
      settings = await SystemSettings.create({
        key: 'premium_settings',
        value: JSON.stringify(newSettings)
      });
    } else {
      await settings.update({
        value: JSON.stringify(newSettings)
      });
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: JSON.parse(settings.value)
    });
  } catch (error) {
    console.error('Update premium settings error:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};

// Get referral settings
exports.getReferralSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ where: { key: 'referral_settings' } });
    
    if (!settings) {
      // Create default settings
      const defaultSettings = {
        pointsPerReferral: 50,
        enabled: true,
        requireVerification: true,
        bonusForPremiumReferral: 100
      };

      settings = await SystemSettings.create({
        key: 'referral_settings',
        value: JSON.stringify(defaultSettings)
      });
    }

    res.json({
      success: true,
      settings: JSON.parse(settings.value)
    });
  } catch (error) {
    console.error('Get referral settings error:', error);
    res.status(500).json({ message: 'Failed to fetch referral settings' });
  }
};

// Update referral settings
exports.updateReferralSettings = async (req, res) => {
  try {
    const newSettings = req.body;

    let settings = await SystemSettings.findOne({ where: { key: 'referral_settings' } });
    
    if (!settings) {
      settings = await SystemSettings.create({
        key: 'referral_settings',
        value: JSON.stringify(newSettings)
      });
    } else {
      await settings.update({
        value: JSON.stringify(newSettings)
      });
    }

    res.json({
      success: true,
      message: 'Referral settings updated successfully',
      settings: JSON.parse(settings.value)
    });
  } catch (error) {
    console.error('Update referral settings error:', error);
    res.status(500).json({ message: 'Failed to update referral settings' });
  }
};

// Get popup settings (WhatsApp group, announcements, etc.)
exports.getPopupSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ where: { key: 'popup_settings' } });
    
    if (!settings) {
      // Create default settings
      const defaultSettings = {
        whatsappGroupLink: '',
        whatsappEnabled: false,
        popupTitle: 'Join Our Community!',
        popupMessage: 'Join our WhatsApp group for exclusive updates and support.',
        showOnLogin: true,
        showOnDashboard: true,
        popupDelaySeconds: 2,
        buttonText: 'Join WhatsApp Group'
      };

      settings = await SystemSettings.create({
        key: 'popup_settings',
        value: JSON.stringify(defaultSettings)
      });
    }

    res.json({
      success: true,
      settings: JSON.parse(settings.value)
    });
  } catch (error) {
    console.error('Get popup settings error:', error);
    res.status(500).json({ message: 'Failed to fetch popup settings' });
  }
};

// Update popup settings
exports.updatePopupSettings = async (req, res) => {
  try {
    const newSettings = req.body;

    let settings = await SystemSettings.findOne({ where: { key: 'popup_settings' } });
    
    if (!settings) {
      settings = await SystemSettings.create({
        key: 'popup_settings',
        value: JSON.stringify(newSettings)
      });
    } else {
      await settings.update({
        value: JSON.stringify(newSettings)
      });
    }

    res.json({
      success: true,
      message: 'Popup settings updated successfully',
      settings: JSON.parse(settings.value)
    });
  } catch (error) {
    console.error('Update popup settings error:', error);
    res.status(500).json({ message: 'Failed to update popup settings' });
  }
};

module.exports = exports;
