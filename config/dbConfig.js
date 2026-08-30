const fs = require('fs');
require('dotenv').config();

const SOCKET_CANDIDATES = [
  process.env.DB_SOCKET,
  '/var/run/mysqld/mysqld.sock',
  '/tmp/mysql.sock',
  '/var/lib/mysql/mysql.sock',
].filter(Boolean);

function getDbConfig(extra = {}) {
  const config = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blueprint',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...extra,
  };

  const socketPath = SOCKET_CANDIDATES.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });

  // Hostinger MySQL user is '@localhost' (socket). TCP 127.0.0.1 is a different user.
  if (socketPath) {
    config.socketPath = socketPath;
  } else {
    config.host = process.env.DB_HOST || 'localhost';
    config.port = Number(process.env.DB_PORT || 3306);
  }

  return config;
}

module.exports = { getDbConfig };
