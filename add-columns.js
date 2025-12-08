const sequelize = require('./config/database');

async function addColumns() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Add key column
    await sequelize.query(`
      ALTER TABLE "SystemSettings" 
      ADD COLUMN IF NOT EXISTS "key" VARCHAR(255);
    `);
    console.log('✅ Added key column');

    // Add value column
    await sequelize.query(`
      ALTER TABLE "SystemSettings" 
      ADD COLUMN IF NOT EXISTS "value" TEXT;
    `);
    console.log('✅ Added value column');

    await sequelize.close();
    console.log('✅ Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addColumns();
