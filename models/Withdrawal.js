const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Withdrawal = sequelize.define('Withdrawal', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ambassadorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Ambassadors',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  upiId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'rejected'),
    defaultValue: 'pending'
  },
  requestedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'Withdrawals',
  timestamps: true
});

module.exports = Withdrawal;
