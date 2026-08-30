const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');

let loadedFrom = [];

function loadEnv() {
  if (loadEnv.done) {
    return loadedFrom;
  }

  const homeEnv = path.join(os.homedir(), 'blueprint.env');
  const appEnv = path.join(__dirname, '..', '.env');

  // Home file first so Hostinger deploys still have DB credentials
  // after hbuilds/current is replaced. App .env overrides if present.
  if (fs.existsSync(homeEnv)) {
    dotenv.config({ path: homeEnv, override: true });
    loadedFrom.push(homeEnv);
  }

  if (fs.existsSync(appEnv)) {
    dotenv.config({ path: appEnv, override: true });
    loadedFrom.push(appEnv);
  }

  if (loadedFrom.length === 0) {
    dotenv.config({ override: true });
  }

  loadEnv.done = true;
  return loadedFrom;
}

loadEnv.done = false;

module.exports = { loadEnv };
