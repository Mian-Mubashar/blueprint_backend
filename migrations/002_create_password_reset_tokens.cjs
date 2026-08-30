/**
 * Migration: Create password_reset_tokens table for forgot password functionality
 * 
 * This migration creates the password_reset_tokens table which stores
 * password reset tokens for users who request password resets.
 */

async function up(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_id (user_id),
      INDEX idx_expires_at (expires_at)
    )
  `);
}

module.exports = { up };

