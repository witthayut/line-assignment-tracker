// Loads ../.env (project root) and ./.env, then runs the given command.
// Used so Prisma CLI commands see DATABASE_URL from the shared root .env.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function load(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

load(path.join(__dirname, '..', '.env'));
load(path.join(__dirname, '..', '..', '.env'));

const [cmd, ...args] = process.argv.slice(2);
const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
process.exit(result.status ?? 1);
