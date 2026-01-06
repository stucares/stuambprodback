const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemSettings = sequelize.define('SystemSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING,

    allowNull: false,
    comment: 'Setting key (e.g., withdrawal_settings, premium_settings)'
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'JSON string containing setting values'
  },
  // Legacy fields for withdrawal settings (kept for backward compatibility)
  minWithdrawalPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  pointsToRupeeRatio: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 1.00,
    comment: 'How many rupees per point (e.g., 1.00 means 100 points = ₹100)'
  },
  withdrawalLockDays: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    comment: 'Days to wait between withdrawals'
  },
  processingMessage: {
    type: DataTypes.TEXT,
    defaultValue: 'Your withdrawal request will be processed within 24 hours'
  }
}, {
  tableName: 'SystemSettings',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['key']
    }
  ]
});

module.exports = SystemSettings;
