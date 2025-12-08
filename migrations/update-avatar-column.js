const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

async function updateAvatarColumn() {
  try {
    console.log('Starting migration to update avatar column...');
    
    // Change avatar column to TEXT type
    await sequelize.query(
      'ALTER TABLE "Ambassadors" ALTER COLUMN "avatar" TYPE TEXT',
      { type: QueryTypes.RAW }
    );
    
    console.log('✅ Successfully updated avatar column to TEXT type');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

updateAvatarColumn();
