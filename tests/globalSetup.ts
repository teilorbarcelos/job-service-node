import { TestUtil } from './TestUtil.js';

export async function setup() {
  if (process.env.USE_REAL_DB === 'true') {
    await TestUtil.setupContainers();
  }
}

export async function teardown() {
  if (process.env.USE_REAL_DB === 'true') {
    await TestUtil.teardownContainers();
  }
}
