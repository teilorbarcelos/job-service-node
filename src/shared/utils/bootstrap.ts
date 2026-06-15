import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { bcryptPool } from '../../infra/bcrypt/BcryptPool.js';
import { CONFIG } from '../config/env.js';
import { logger } from './logger.js';

export async function bootstrapSystem() {
  const email = CONFIG.FIRST_USER;
  const password = CONFIG.FIRST_PASSWORD;

  if (!email || !password) return;

  const pool = new Pool({ connectionString: CONFIG.DATABASE.URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const hashedPassword = await bcryptPool.hash(password, CONFIG.BCRYPT_ROUNDS);

    if (existingUser) {
      return logger.info({ email }, 'O usuário mestre já existe. Pulando inicialização.');
    }

    logger.info({ email }, 'Criando o primeiro usuário mestre');

    await prisma.auth.create({
      data: {
        password: hashedPassword,
        first_access: false,
        active: true,
        User: {
          create: {
            name: 'Administrador Supremo',
            email: email,
            id_role: 'administrator',
            active: true
          }
        }
      }
    });

    logger.info('Usuário configurado com sucesso!');
  } catch (err) {
    logger.error({ err }, 'Falha ao injetar o usuário inicial');
  } finally {
    await prisma.$disconnect();
  }
}
