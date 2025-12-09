const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addUpiIdColumn() {
  try {
    console.log('Starting migration: Adding upiId column to Ambassadors table...');

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Ambassadors' 
      AND column_name = 'upiId';
    `);

    if (results.length > 0) {
      console.log('✓ upiId column already exists');
      return;
    }

    // Add the upiId column
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ADD COLUMN "upiId" VARCHAR(255);
    `);

    console.log('✓ Successfully added upiId column to Ambassadors table');

  } catch (error) {
    console.error('Error adding upiId column:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  addUpiIdColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addUpiIdColumn;
