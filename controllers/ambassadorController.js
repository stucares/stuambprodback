const { Ambassador, Referral, Task } = require('../models');

// Get Ambassador Profile
exports.getProfile = async (req, res) => {
  try {
    const ambassador = await Ambassador.findByPk(req.ambassador.id, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      ambassador
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

// Update Ambassador Profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, age, collegeName, phoneNumber, avatar } = req.body;
    const ambassador = req.ambassador;

    if (name) ambassador.name = name;
    if (age) ambassador.age = age;
    if (collegeName) ambassador.collegeName = collegeName;
    if (phoneNumber) ambassador.phoneNumber = phoneNumber;
    if (avatar) ambassador.avatar = avatar;

    await ambassador.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        email: ambassador.email,
        age: ambassador.age,
        collegeName: ambassador.collegeName,
        phoneNumber: ambassador.phoneNumber
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Get Ambassador Statistics
exports.getStats = async (req, res) => {
  try {
    const ambassador = req.ambassador;
    
    const totalReferrals = await Referral.count({
      where: { ambassadorId: ambassador.id }
    });

    const completedReferrals = await Referral.count({
      where: { 
        ambassadorId: ambassador.id,
        status: 'completed'
      }
    });

    const pendingReferrals = await Referral.count({
      where: { 
        ambassadorId: ambassador.id,
        status: 'pending'
      }
    });

    res.json({
      success: true,
      stats: {
        level: ambassador.level,
        referralCount: ambassador.referralCount,
        creditPoints: ambassador.creditPoints,
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        uniqueCode: ambassador.uniqueCode
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
};

// Get All Tasks
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    // Replace {{CODE}} placeholder with ambassador's unique code
    const tasksWithCode = tasks.map(task => {
      const taskData = task.toJSON();
      return {
        ...taskData,
        messageTemplate: taskData.messageTemplate.replace(/\{\{CODE\}\}/gi, req.ambassador.uniqueCode)
      };
    });

    res.json({
      success: true,
      tasks: tasksWithCode
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message 
    });
  }
};

// Get Referrals History
exports.getReferrals = async (req, res) => {
  try {
    const referrals = await Referral.findAll({
      where: { ambassadorId: req.ambassador.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      referrals
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ message: 'Failed to fetch referrals' });
  }
};
