const fs = require('fs');
const { loadEnv } = require('./loadEnv');

const loadedEnvFiles = loadEnv();

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(
      `Missing ${name}. Set it in .env (local) or ~/blueprint.env (Hostinger). Nothing is hardcoded.`
    );
  }
  return value;
}

function getDbConfig(extra = {}) {
  const host = requiredEnv('DB_HOST');
  const config = {
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: requiredEnv('DB_NAME'),
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...extra,
  };

  const socketCandidates = [
    process.env.DB_SOCKET,
    '/var/run/mysqld/mysqld.sock',
    '/tmp/mysql.sock',
    '/var/lib/mysql/mysql.sock',
  ].filter(Boolean);

  const socketPath = socketCandidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });

  if (socketPath) {
    config.socketPath = socketPath;
  } else {
    config.host = host;
  }

  return config;
}

function describeDbTarget() {
  return {
    user: process.env.DB_USER || '(not set)',
    database: process.env.DB_NAME || '(not set)',
    host: process.env.DB_HOST || '(not set)',
    envFiles: loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none',
  };
}

module.exports = { getDbConfig, describeDbTarget };
