import { start } from './app.js';

try {
  await start();
} catch (err) {
  if (err instanceof Error && err.message === 'Environment validation failed') {
    process.exit(1);
  }
  throw err;
}
