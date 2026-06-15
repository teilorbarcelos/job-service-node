import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import { Redis } from 'ioredis';

export class TestUtil {
  private static postgresContainer: StartedPostgreSqlContainer;
  private static redisContainer: StartedRedisContainer;

  static async setupContainers() {
    console.log('🚀 Iniciando containers para testes de integração...');

    // Postgres
    this.postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('testdb')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    const pgUrl = this.postgresContainer.getConnectionUri();
    process.env.DATABASE_URL = pgUrl;
    process.env.DATABASE_URL_AUDIT = pgUrl; // Usamos o mesmo para simplificar nos testes

    console.log(`✅ Postgres pronto: ${pgUrl}`);

    // Redis
    this.redisContainer = await new RedisContainer('redis:7-alpine')
      .start();

    const redisHost = this.redisContainer.getHost();
    const redisPort = this.redisContainer.getMappedPort(6379).toString();
    
    process.env.REDIS_HOST = redisHost;
    process.env.REDIS_PORT = redisPort;

    console.log(`✅ Redis pronto: ${redisHost}:${redisPort}`);

    // Rodar migrações
    console.log('🔄 Rodando migrações no banco de teste...');
    execSync('npx prisma migrate deploy --schema=./prisma/main/schema.prisma', {
      env: { ...process.env, DATABASE_URL: pgUrl },
      stdio: 'inherit'
    });
    execSync('npx prisma migrate deploy --schema=./prisma/audit/audit.prisma', {
      env: { ...process.env, DATABASE_URL: pgUrl },
      stdio: 'inherit'
    });
    console.log('✅ Migrações concluídas.');

    // Seed data
    console.log('🔄 Populando dados de teste...');
    execSync('npx prisma db seed', {
      env: { ...process.env, DATABASE_URL: pgUrl },
      stdio: 'inherit'
    });
    console.log('✅ Seed concluído.');

    // Smoke test — validates real DB connection is working
    console.log('🔍 Verificando conexão com banco real...');
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: pgUrl });
    const result = await pool.query('SELECT 1 AS ok');
    console.log(`✅ Banco real respondendo: ${result.rows[0].ok}`);

    const r = new Redis({ host: redisHost, port: Number(redisPort) });
    const pong = await r.ping();
    console.log(`✅ Redis real respondendo: ${pong}`);
    await r.quit();
    await pool.end();
  }

  static async teardownContainers() {
    console.log('🛑 Encerrando containers de teste...');
    if (this.postgresContainer) await this.postgresContainer.stop();
    if (this.redisContainer) await this.redisContainer.stop();
    console.log('✅ Containers encerrados.');
  }
}
