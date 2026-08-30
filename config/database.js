const mysql = require('mysql2/promise');
const { getDbConfig } = require('./dbConfig');

const pool = mysql.createPool(getDbConfig());

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Server will keep running; fix DB and restart.');
  }
};

testConnection();

module.exports = pool;
