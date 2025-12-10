const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addPremiumTaskField() {
  try {
    console.log('Starting migration: Adding isPremiumOnly column to Tasks table...');

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Tasks' 
      AND column_name = 'isPremiumOnly';
    `);

    if (results.length > 0) {
      console.log('✓ isPremiumOnly column already exists');
      return;
    }

    // Add the isPremiumOnly column
    await sequelize.query(`
      ALTER TABLE "Tasks" 
      ADD COLUMN "isPremiumOnly" BOOLEAN DEFAULT false;
    `);

    console.log('✓ Successfully added isPremiumOnly column to Tasks table');
    console.log('✓ Premium-only tasks feature is now enabled');

  } catch (error) {
    console.error('Error adding isPremiumOnly column:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  addPremiumTaskField()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addPremiumTaskField;
