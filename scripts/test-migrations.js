const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blueprint_financial',
  port: process.env.DB_PORT || 3306
};

async function testMigrations() {
  let connection;

  try {
    console.log('========================================');
    console.log('Testing Database Migrations');
    console.log('========================================');
    console.log('');

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    console.log('');

    // Test 1: Check all tables exist
    console.log('📋 Testing Tables...');
    const expectedTables = [
      'users',
      'loan_applications',
      'payments',
      'contact_submissions',
      'system_settings',
      'password_reset_tokens',
      'migrations'
    ];

    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);

    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log(`Found ${existingTables.length} tables in database`);

    let allTablesExist = true;
    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table} table exists`);
      } else {
        console.log(`   ❌ ${table} table MISSING`);
        allTablesExist = false;
      }
    }

    console.log('');

    // Test 2: Check users table columns
    console.log('👤 Testing Users Table Structure...');
    const [userColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `);

    const expectedUserColumns = [
      'id', 'email', 'password', 'first_name', 'last_name', 'phone',
      'date_of_birth', 'address', 'city', 'state', 'country', 'bvn',
      'bank_account_number', 'bank_name', 'account_name', 'employment_status',
      'monthly_income', 'employer_name', 'job_title', 'employment_duration',
      'is_verified', 'verification_documents', 'google_id', 'profile_picture',
      'role', 'created_at', 'updated_at'
    ];

    const existingUserColumns = userColumns.map(c => c.COLUMN_NAME);
    console.log(`Found ${existingUserColumns.length} columns in users table`);

    for (const col of expectedUserColumns) {
      if (existingUserColumns.includes(col)) {
        console.log(`   ✅ ${col} column exists`);
      } else {
        console.log(`   ❌ ${col} column MISSING`);
        allTablesExist = false;
      }
    }

    console.log('');

    // Test 3: Check loan_applications table
    console.log('💰 Testing Loan Applications Table...');
    const [loanColumns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_applications'
    `);
    console.log(`   ✅ loan_applications has ${loanColumns.length} columns`);

    // Test 4: Check payments table
    console.log('💳 Testing Payments Table...');
    const [paymentColumns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
    `);
    console.log(`   ✅ payments has ${paymentColumns.length} columns`);

    // Test 5: Check indexes
    console.log('');
    console.log('🔍 Testing Indexes...');
    const [indexes] = await connection.execute(`
      SELECT TABLE_NAME, INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      AND INDEX_NAME != 'PRIMARY'
      GROUP BY TABLE_NAME, INDEX_NAME
    `);
    console.log(`   ✅ Found ${indexes.length} indexes`);

    // Test 6: Check views
    console.log('');
    console.log('👁️  Testing Views...');
    const [views] = await connection.execute(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.VIEWS
      WHERE TABLE_SCHEMA = DATABASE()
    `);
    const viewNames = views.map(v => v.TABLE_NAME);
    console.log(`   ✅ Found ${views.length} views`);
    if (viewNames.includes('loan_application_summary')) {
      console.log('   ✅ loan_application_summary view exists');
    } else {
      console.log('   ❌ loan_application_summary view MISSING');
    }
    if (viewNames.includes('payment_summary')) {
      console.log('   ✅ payment_summary view exists');
    } else {
      console.log('   ❌ payment_summary view MISSING');
    }

    // Test 7: Check foreign keys
    console.log('');
    console.log('🔗 Testing Foreign Keys...');
    const [foreignKeys] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log(`   ✅ Found ${foreignKeys.length} foreign keys`);

    // Final summary
    console.log('');
    console.log('========================================');
    if (allTablesExist && existingUserColumns.length >= 25) {
      console.log('✅ All migrations tested successfully!');
      console.log('✅ Database structure is complete!');
    } else {
      console.log('⚠️  Some issues found. Please run migrations:');
      console.log('   npm run migrate');
    }
    console.log('========================================');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   Database not found. Please create it first.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Database access denied. Check your .env file.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testMigrations();

