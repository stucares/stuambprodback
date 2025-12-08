const sequelize = require('../config/database');
const Ambassador = require('./Ambassador');
const Admin = require('./Admin');
const Task = require('./Task');
const Referral = require('./Referral');
const Withdrawal = require('./Withdrawal');
const SystemSettings = require('./SystemSettings');

// Define associations
Referral.belongsTo(Ambassador, { foreignKey: 'ambassadorId', as: 'ambassador' });
Ambassador.hasMany(Referral, { foreignKey: 'ambassadorId', as: 'referrals' });

Withdrawal.belongsTo(Ambassador, { foreignKey: 'ambassadorId', as: 'ambassador' });
Ambassador.hasMany(Withdrawal, { foreignKey: 'ambassadorId', as: 'withdrawals' });

module.exports = {
  sequelize,
  Ambassador,
  Admin,
  Task,
  Referral,
  Withdrawal,
  SystemSettings
};
