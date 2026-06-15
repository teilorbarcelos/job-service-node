import { defineConfig } from '@prisma/config';
import 'dotenv/config';

const isAudit = process.argv.join(' ').includes('audit.prisma');

export default defineConfig({
  schema: isAudit ? './prisma/audit/audit.prisma' : './prisma/main/schema.prisma',
  datasource: {
    url: isAudit ? process.env.DATABASE_URL_AUDIT : process.env.DATABASE_URL
  },
  migrations: {
    seed: 'tsx prisma/main/seed/seed.ts',
  }
} as {});
