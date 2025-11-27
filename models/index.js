const sequelize = require('../config/database');
const Ambassador = require('./Ambassador');
const Admin = require('./Admin');
const Task = require('./Task');
const Referral = require('./Referral');

// Define associations
Referral.belongsTo(Ambassador, { foreignKey: 'ambassadorId', as: 'ambassador' });
Ambassador.hasMany(Referral, { foreignKey: 'ambassadorId', as: 'referrals' });

module.exports = {
  sequelize,
  Ambassador,
  Admin,
  Task,
  Referral
};
