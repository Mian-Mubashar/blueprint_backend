const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blueprint_financial',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function runSeeder(connection, seederFile) {
  try {
    const seederName = path.basename(seederFile, '.js');
    console.log(`   Running seeder: ${seederName}...`);

    // Load and execute the seeder module
    const seederPath = path.resolve(seederFile);
    delete require.cache[require.resolve(seederPath)];
    const seeder = require(seederPath);

    if (typeof seeder.seed !== 'function') {
      throw new Error(`Seeder ${seederName} must export a 'seed' function`);
    }

    // Execute the seeder
    await seeder.seed(connection);

    console.log(`   ✅ ${seederName} completed`);
    return true;
  } catch (error) {
    // If it's a duplicate key error, that's okay (idempotent)
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_DUP_FIELDNAME') {
      console.log(`   ⚠️  ${path.basename(seederFile, '.js')} already applied (skipping duplicates)`);
      return true;
    }
    console.error(`   ❌ Error running seeder ${path.basename(seederFile, '.js')}:`, error.message);
    throw error;
  }
}

async function main() {
  let connection;

  try {
    console.log('========================================');
    console.log('Running Database Seeders');
    console.log('========================================');
    console.log('');

    // Create connection
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    console.log('');

    // Get list of seeder files
    const seedersDir = path.join(__dirname, '..', 'seeders');
    const files = await fs.readdir(seedersDir);
    const seederFiles = files
      .filter(file => file.endsWith('.js') && !file.startsWith('README'))
      .sort()
      .map(file => path.join(seedersDir, file));

    if (seederFiles.length === 0) {
      console.log('⚠️  No seeder files found (.js)');
      return;
    }

    console.log(`Found ${seederFiles.length} seeder(s)`);
    console.log('');

    // Run all seeders
    for (const seederFile of seederFiles) {
      await runSeeder(connection, seederFile);
      console.log('');
    }

    console.log('========================================');
    console.log('All seeders completed successfully!');
    console.log('========================================');
    console.log('');
    console.log('Admin Credentials:');
    console.log('  Email: admin@blueprint.com');
    console.log('  Password: Admin@123');
    console.log('');

  } catch (error) {
    console.error('❌ Seeder failed:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Database access denied. Please check your .env file:');
      console.error('   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   Database not found. Please run migrations first.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
