/**
 * Migration: Add role column to users table for role-based access control
 * 
 * This migration adds role-based access control to the users table.
 * It adds a 'role' column with enum values 'user' and 'admin'.
 * Default role is 'user' for all existing and new users.
 */

async function up(connection) {
  // Check if role column already exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'role'
  `);

  if (columns.length === 0) {
    // Add role column
    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER profile_picture
    `);

    // Add index for role column
    try {
      await connection.execute(`
        CREATE INDEX idx_role ON users(role)
      `);
    } catch (e) {
      // Index might already exist
      if (e.code !== 'ER_DUP_KEYNAME') {
        throw e;
      }
    }
  }
}

module.exports = { up };

