require('dotenv').config();
const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function testDatabase() {
    console.log('🔍 Testing database connection...\n');

    try {
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connection successful');
        console.log(`   Database: ${process.env.DB_NAME}`);
        console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        console.log(`   User: ${process.env.DB_USER}\n`);

        // Test query
        console.log('🔍 Testing ambassadors table...');
        const result = await sequelize.query(
            'SELECT COUNT(*) as count FROM ambassadors',
            { type: QueryTypes.SELECT }
        );
        console.log(`✅ Ambassadors table accessible`);
        console.log(`   Total ambassadors: ${result[0].count}\n`);

        // List some ambassadors
        console.log('📋 Sample ambassadors:');
        const ambassadors = await sequelize.query(
            'SELECT id, name, email FROM ambassadors LIMIT 5',
            { type: QueryTypes.SELECT }
        );

        if (ambassadors.length > 0) {
            ambassadors.forEach(amb => {
                console.log(`   - ${amb.name} (${amb.email})`);
            });
        } else {
            console.log('   No ambassadors found in database');
        }

        console.log('\n✅ All database tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Database Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('\n⚠️  Check your .env file database configuration:');
        console.error(`   DB_HOST=${process.env.DB_HOST}`);
        console.error(`   DB_PORT=${process.env.DB_PORT}`);
        console.error(`   DB_NAME=${process.env.DB_NAME}`);
        console.error(`   DB_USER=${process.env.DB_USER}`);
        process.exit(1);
    }
}

testDatabase();
