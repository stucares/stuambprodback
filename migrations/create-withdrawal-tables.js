const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

async function createWithdrawalTables() {
  try {
    console.log('Starting migration to create withdrawal tables...');
    
    // Add UPI fields to Ambassadors table
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ADD COLUMN IF NOT EXISTS "upiId" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "lastWithdrawalAt" TIMESTAMP WITH TIME ZONE;
    `, { type: QueryTypes.RAW });
    console.log('✅ Updated Ambassadors table');
    
    // Create SystemSettings table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SystemSettings" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "minWithdrawalPoints" INTEGER DEFAULT 100,
        "pointsToRupeeRatio" DECIMAL(10,2) DEFAULT 1.00,
        "withdrawalLockDays" INTEGER DEFAULT 7,
        "processingMessage" TEXT DEFAULT 'Your withdrawal request will be processed within 24 hours',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `, { type: QueryTypes.RAW });
    console.log('✅ Created SystemSettings table');
    
    // Create Withdrawals table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Withdrawals" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "ambassadorId" UUID NOT NULL REFERENCES "Ambassadors"("id") ON DELETE CASCADE,
        "amount" DECIMAL(10,2) NOT NULL,
        "points" INTEGER NOT NULL,
        "upiId" VARCHAR(255) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'pending' CHECK ("status" IN ('pending', 'processing', 'completed', 'rejected')),
        "requestedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP WITH TIME ZONE,
        "adminNotes" TEXT,
        "transactionId" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `, { type: QueryTypes.RAW });
    console.log('✅ Created Withdrawals table');
    
    // Insert default settings if not exists
    await sequelize.query(`
      INSERT INTO "SystemSettings" ("id", "minWithdrawalPoints", "pointsToRupeeRatio", "withdrawalLockDays", "processingMessage")
      SELECT gen_random_uuid(), 100, 1.00, 7, 'Your withdrawal request will be processed within 24 hours'
      WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings");
    `, { type: QueryTypes.RAW });
    console.log('✅ Inserted default system settings');
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createWithdrawalTables();
