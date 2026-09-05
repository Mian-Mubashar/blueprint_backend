const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { getDbConfig, describeDbTarget } = require('../config/dbConfig');

const dbConfig = getDbConfig({ multipleStatements: true });

async function ensureMigrationsTable(connection) {
  // Create migrations table if it doesn't exist
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_migration_name (migration_name)
    )
  `);
}

async function getExecutedMigrations(connection) {
  const [rows] = await connection.execute(
    'SELECT migration_name FROM migrations ORDER BY migration_name'
  );
  return rows.map(row => row.migration_name);
}

async function markMigrationAsExecuted(connection, migrationName) {
  await connection.execute(
    'INSERT INTO migrations (migration_name) VALUES (?) ON DUPLICATE KEY UPDATE migration_name = VALUES(migration_name)',
    [migrationName]
  );
}

async function runMigration(connection, migrationFile) {
  try {
    const migrationName = path.basename(migrationFile, '.cjs');
    console.log(`   Running migration: ${migrationName}...`);

    // Load and execute the migration module
    const migrationPath = path.resolve(migrationFile);
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${migrationName} must export an 'up' function`);
    }

    // Execute the migration
    await migration.up(connection);

    // Mark as executed
    await markMigrationAsExecuted(connection, migrationName);
    console.log(`   ✅ ${migrationName} completed`);
    return true;
  } catch (error) {
    // If it's a duplicate key error or column already exists, that's okay (idempotent)
    if (error.code === 'ER_DUP_ENTRY' || 
        error.code === 'ER_DUP_FIELDNAME' || 
        error.code === 'ER_DUP_KEYNAME' ||
        error.message.includes('already exists') ||
        error.message.includes('Duplicate column')) {
      console.log(`   ⚠️  ${path.basename(migrationFile, '.cjs')} already applied (skipping)`);
      return true;
    }
    console.error(`   ❌ Error running migration ${path.basename(migrationFile, '.cjs')}:`, error.message);
    throw error;
  }
}

async function main() {
  let connection;

  try {
    console.log('========================================');
    console.log('Running Database Migrations');
    console.log('========================================');
    console.log('');

    // Create connection
    console.log('Connecting to database...');
    const target = describeDbTarget();
    console.log(`Env file(s): ${target.envFiles}`);
    console.log(`DB user: ${target.user}  database: ${target.database}  host: ${target.host}`);
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    console.log('');

    // Ensure migrations table exists
    await ensureMigrationsTable(connection);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.cjs'))
      .sort()
      .map(file => path.join(migrationsDir, file));

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found (.cjs)');
      return;
    }

    // Get executed migrations
    const executedMigrations = await getExecutedMigrations(connection);
    console.log(`Found ${migrationFiles.length} migration(s), ${executedMigrations.length} already executed`);
    console.log('');

    // Run pending migrations
    let executedCount = 0;
    for (const migrationFile of migrationFiles) {
      const migrationName = path.basename(migrationFile, '.cjs');
      
      if (executedMigrations.includes(migrationName)) {
        console.log(`   ⏭️  ${migrationName} already executed (skipping)`);
        continue;
      }

      await runMigration(connection, migrationFile);
      executedCount++;
      console.log('');
    }

    console.log('========================================');
    if (executedCount > 0) {
      console.log(`✅ ${executedCount} migration(s) executed successfully!`);
    } else {
      console.log('✅ All migrations are up to date!');
    }
    console.log('========================================');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Access denied. Check DB_USER, DB_PASSWORD, DB_HOST, DB_NAME in .env.');
      console.error('   Local MySQL: DB_USER=root and DB_NAME=blueprint (Hostinger user will not work on your PC).');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   Database not found. Please create the database first.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();

