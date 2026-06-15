import pino from 'pino';
import { CONFIG } from '../config/env.js';

export const logger = pino({
  level: CONFIG.LOG_LEVEL,
  redact: {
    paths: ['password', 'newPassword', 'currentPassword', 'token', 'refreshToken'],
    censor: '******',
  },
});
