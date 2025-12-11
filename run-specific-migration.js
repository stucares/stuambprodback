const sequelize = require('./config/database');
const migration = require('./migrations/add-referral-and-approval-fields');

async function runMigration() {
  try {
    console.log('🔄 Running referral and approval fields migration...');
    await migration.up(sequelize.getQueryInterface());
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
