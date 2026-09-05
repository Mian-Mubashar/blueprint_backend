const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');

let loadedFrom = [];

function loadEnv() {
  if (loadEnv.done) {
    return loadedFrom;
  }

  const appEnv = path.join(__dirname, '..', '.env');
  const homeEnv = path.join(os.homedir(), 'blueprint.env');

  // Local and deploys: always prefer the app .env.
  // Hostinger only: if deploy wiped .env, fall back to ~/blueprint.env.
  if (fs.existsSync(appEnv)) {
    dotenv.config({ path: appEnv, override: true });
    loadedFrom.push(appEnv);
  } else if (fs.existsSync(homeEnv)) {
    dotenv.config({ path: homeEnv, override: true });
    loadedFrom.push(homeEnv);
  } else {
    dotenv.config({ override: true });
  }

  loadEnv.done = true;
  return loadedFrom;
}

loadEnv.done = false;

module.exports = { loadEnv };
