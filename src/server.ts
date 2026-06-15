import { execSync } from 'node:child_process';
import { start } from './app.js';
import { CONFIG } from './shared/config/env.js';

if (CONFIG.MIGRATE_ONLY) {
  console.log('[MIGRATE_ONLY] Running database migrations...');
  execSync('npm run prisma:deploy:main && npm run prisma:deploy:audit', { stdio: 'inherit' });
  console.log('[MIGRATE_ONLY] Migrations complete. Exiting.');
  process.exit(0);
}

start();
