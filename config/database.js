const mysql = require('mysql2/promise');
require('dotenv').config();

// const dbConfig = {
//   host: process.env.DB_HOST || 'localhost',
//   user: process.env.DB_USER || 'root',
//   password: process.env.DB_PASSWORD || '',
//   database: process.env.DB_NAME || 'blueprint_financial',
//   port: process.env.DB_PORT || 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   acquireTimeout: 60000,
//   timeout: 60000,
//   reconnect: true
// };

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blueprint_financial',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,      // valid for pools
  connectionLimit: 10,            // valid for pools
  queueLimit: 0                   
};
// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Initialize database connection
testConnection();

module.exports = pool;