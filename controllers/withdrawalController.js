const { Withdrawal, Ambassador, SystemSettings } = require('../models');
const { Op } = require('sequelize');
const { sendWithdrawalNotification, sendWithdrawalApprovalEmail } = require('../services/emailService');

// Get system settings
exports.getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({
      where: { key: 'withdrawal_settings' }
    });
    
    // Create default settings if they don't exist
    if (!settings) {
      const defaultSettings = {
        minWithdrawalPoints: 100,
        pointsToRupeeRatio: 1.00,
        withdrawalLockDays: 7,
        processingMessage: 'Your withdrawal request will be processed within 24 hours'
      };
      settings = await SystemSettings.create({
        key: 'withdrawal_settings',
        value: JSON.stringify(defaultSettings)
      });
    }
    
    const settingsData = JSON.parse(settings.value);
    
    res.json({
      success: true,
      settings: settingsData
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Request withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const { points, upiId } = req.body;
    const ambassadorId = req.ambassador.id;
    
    if (!points || !upiId) {
      return res.status(400).json({ message: 'Points and UPI ID are required' });
    }
    
    // Get system settings
    let settings = await SystemSettings.findOne({
      where: { key: 'withdrawal_settings' }
    });
    if (!settings) {
      const defaultSettings = {
        minWithdrawalPoints: 100,
        pointsToRupeeRatio: 1.00,
        withdrawalLockDays: 7,
        processingMessage: 'Your withdrawal request will be processed within 24 hours'
      };
      settings = await SystemSettings.create({
        key: 'withdrawal_settings',
        value: JSON.stringify(defaultSettings)
      });
    }
    const settingsData = JSON.parse(settings.value);
    
    // Get ambassador
    const ambassador = await Ambassador.findByPk(ambassadorId);
    
    // Check if ambassador has enough points
    if (ambassador.creditPoints < points) {
      return res.status(400).json({ 
        message: `Insufficient points. You have ${ambassador.creditPoints} points.` 
      });
    }
    
    // Check minimum withdrawal
    if (points < settingsData.minWithdrawalPoints) {
      return res.status(400).json({ 
        message: `Minimum withdrawal is ${settingsData.minWithdrawalPoints} points` 
      });
    }
    
    // Check withdrawal lock period
    if (ambassador.lastWithdrawalAt) {
      const daysSinceLastWithdrawal = Math.floor(
        (Date.now() - new Date(ambassador.lastWithdrawalAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastWithdrawal < settingsData.withdrawalLockDays) {
        const daysRemaining = settingsData.withdrawalLockDays - daysSinceLastWithdrawal;
        return res.status(400).json({ 
          message: `You can request withdrawal again in ${daysRemaining} days` 
        });
      }
    }
    
    // Calculate amount
    const amount = (points * parseFloat(settingsData.pointsToRupeeRatio)).toFixed(2);
    
    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      ambassadorId,
      amount,
      points,
      upiId,
      status: 'pending'
    });
    
    // Deduct points from ambassador
    ambassador.creditPoints -= points;
    ambassador.lastWithdrawalAt = new Date();
    await ambassador.save();
    
    // Update UPI ID if not already set
    if (!ambassador.upiId) {
      ambassador.upiId = upiId;
      await ambassador.save();
    }

    // Send withdrawal notification email
    sendWithdrawalNotification({
      name: ambassador.name,
      email: ambassador.email,
      amount: amount,
      upiId: upiId,
      requestId: withdrawal.id,
      requestedAt: withdrawal.createdAt
    }).catch(err => console.error('Failed to send withdrawal notification:', err));
    
    res.status(201).json({
      success: true,
      message: settingsData.processingMessage,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        points: withdrawal.points,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt
      }
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ message: 'Failed to request withdrawal' });
  }
};

// Get ambassador withdrawal history
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const ambassadorId = req.ambassador.id;
    
    const withdrawals = await Withdrawal.findAll({
      where: { ambassadorId },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      withdrawals
    });
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({ message: 'Failed to fetch withdrawal history' });
  }
};

// Admin: Get all withdrawals
exports.getAllWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }
    
    const withdrawals = await Withdrawal.findAll({
      where,
      include: [{
        model: Ambassador,
        as: 'ambassador',
        attributes: ['id', 'name', 'email', 'phoneNumber', 'uniqueCode']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      withdrawals
    });
  } catch (error) {
    console.error('Get all withdrawals error:', error);
    res.status(500).json({ message: 'Failed to fetch withdrawals' });
  }
};

// Admin: Update withdrawal status
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, transactionId } = req.body;
    
    const withdrawal = await Withdrawal.findByPk(id, {
      include: [{
        model: Ambassador,
        as: 'ambassador'
      }]
    });
    
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }
    
    const oldStatus = withdrawal.status;
    withdrawal.status = status;
    
    if (adminNotes) {
      withdrawal.adminNotes = adminNotes;
    }
    
    if (transactionId) {
      withdrawal.transactionId = transactionId;
    }
    
    if (status === 'completed' || status === 'rejected') {
      withdrawal.processedAt = new Date();
    }
    
    // If rejected, refund points to ambassador
    if (status === 'rejected' && oldStatus !== 'rejected') {
      const ambassador = withdrawal.ambassador;
      ambassador.creditPoints += withdrawal.points;
      await ambassador.save();
    }
    
    await withdrawal.save();

    // Send email notification when withdrawal is approved
    if (status === 'completed' && oldStatus !== 'completed') {
      sendWithdrawalApprovalEmail({
        name: withdrawal.ambassador.name,
        email: withdrawal.ambassador.email,
        amount: withdrawal.amount,
        upiId: withdrawal.upiId
      }).catch(err => console.error('Failed to send withdrawal approval email:', err));
    }
    
    res.json({
      success: true,
      message: 'Withdrawal status updated successfully',
      withdrawal
    });
  } catch (error) {
    console.error('Update withdrawal status error:', error);
    res.status(500).json({ message: 'Failed to update withdrawal status' });
  }
};

// Admin: Update system settings
exports.updateSystemSettings = async (req, res) => {
  try {
    const { minWithdrawalPoints, pointsToRupeeRatio, withdrawalLockDays, processingMessage } = req.body;
    
    let settings = await SystemSettings.findOne({
      where: { key: 'withdrawal_settings' }
    });
    
    let settingsData;
    if (!settings) {
      settingsData = {
        minWithdrawalPoints: 100,
        pointsToRupeeRatio: 1.00,
        withdrawalLockDays: 7,
        processingMessage: 'Your withdrawal request will be processed within 24 hours'
      };
    } else {
      settingsData = JSON.parse(settings.value);
    }
    
    if (minWithdrawalPoints !== undefined) settingsData.minWithdrawalPoints = minWithdrawalPoints;
    if (pointsToRupeeRatio !== undefined) settingsData.pointsToRupeeRatio = pointsToRupeeRatio;
    if (withdrawalLockDays !== undefined) settingsData.withdrawalLockDays = withdrawalLockDays;
    if (processingMessage !== undefined) settingsData.processingMessage = processingMessage;
    
    if (!settings) {
      settings = await SystemSettings.create({
        key: 'withdrawal_settings',
        value: JSON.stringify(settingsData)
      });
    } else {
      settings.value = JSON.stringify(settingsData);
      await settings.save();
    }
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: settingsData
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};

// Get withdrawal statistics
exports.getWithdrawalStats = async (req, res) => {
  try {
    const ambassadorId = req.ambassador.id;
    
    const ambassador = await Ambassador.findByPk(ambassadorId, {
      attributes: ['creditPoints', 'lastWithdrawalAt', 'upiId']
    });
    
    let settings = await SystemSettings.findOne({
      where: { key: 'withdrawal_settings' }
    });
    if (!settings) {
      const defaultSettings = {
        minWithdrawalPoints: 100,
        pointsToRupeeRatio: 1.00,
        withdrawalLockDays: 7,
        processingMessage: 'Your withdrawal request will be processed within 24 hours'
      };
      settings = await SystemSettings.create({
        key: 'withdrawal_settings',
        value: JSON.stringify(defaultSettings)
      });
    }
    const settingsData = JSON.parse(settings.value);
    
    // Calculate days until next withdrawal
    let daysUntilNextWithdrawal = 0;
    if (ambassador.lastWithdrawalAt) {
      const daysSinceLastWithdrawal = Math.floor(
        (Date.now() - new Date(ambassador.lastWithdrawalAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      daysUntilNextWithdrawal = Math.max(0, settingsData.withdrawalLockDays - daysSinceLastWithdrawal);
    }
    
    // Get total withdrawn amount
    const totalWithdrawn = await Withdrawal.sum('points', {
      where: {
        ambassadorId,
        status: 'completed'
      }
    }) || 0;
    
    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.count({
      where: {
        ambassadorId,
        status: { [Op.in]: ['pending', 'processing'] }
      }
    });
    
    res.json({
      success: true,
      stats: {
        availablePoints: ambassador.creditPoints,
        totalWithdrawn,
        pendingWithdrawals,
        canWithdraw: daysUntilNextWithdrawal === 0 && ambassador.creditPoints >= settingsData.minWithdrawalPoints,
        daysUntilNextWithdrawal,
        minWithdrawalPoints: settingsData.minWithdrawalPoints,
        pointsToRupeeRatio: settingsData.pointsToRupeeRatio,
        upiId: ambassador.upiId
      }
    });
  } catch (error) {
    console.error('Get withdrawal stats error:', error);
    res.status(500).json({ message: 'Failed to fetch withdrawal stats' });
  }
};
