const bcrypt = require('bcryptjs');

/**
 * Seeder: Seed initial admin user
 * 
 * This seeder creates the default admin user for the system
 * 
 * Default admin credentials:
 *   Email: admin@blueprint.com
 *   Password: Admin@123
 * 
 * IMPORTANT: Change the password immediately in production!
 */

async function seed(connection) {
  // Hash the password
  const hashedPassword = '$2a$12$XIALDewTNrUrb/sjuJrDEOEzmx7LVq7CWYJh5Uf/v2REc31O025zi'; // Admin@123

  // Insert admin user (idempotent - uses ON DUPLICATE KEY UPDATE)
  await connection.execute(`
    INSERT INTO users (
      email,
      password,
      first_name,
      last_name,
      phone,
      date_of_birth,
      country,
      is_verified,
      role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      password = VALUES(password),
      role = VALUES(role),
      is_verified = VALUES(is_verified)
  `, [
    'admin@blueprint.com',
    hashedPassword,
    'System',
    'Admin',
    '+2340000000000',
    '1990-01-01',
    'Nigeria',
    true,
    'admin'
  ]);
}

module.exports = { seed };

