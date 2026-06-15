# job-service-node

> Esqueleto (boilerplate) para execução de **jobs agendados (cron)** em Node.js.
> Conecta-se ao [`backend-node`](../backend-node) para consumir **PostgreSQL**, **Redis** e **RabbitMQ**.

---

## 🎯 O que é

Um **ponto de partida enxuto e idiomático** para quem precisa rodar jobs recorrentes
(limpezas, sincronizações, health checks, relatórios, ETL) em Node.js, sem toda a
complexidade de um backend HTTP completo.

O `backend-node` continua sendo dono do schema, dos migrations e do ciclo de vida
do banco. Os jobs apenas **consomem** esses serviços para executar tarefas agendadas.

### Características

- ✅ **Cron nativo** via [`node-cron`](https://github.com/node-cron/node-cron)
- ✅ **Acesso a PostgreSQL** via [Prisma 7](https://www.prisma.io/) + `pg`
- ✅ **Acesso a Redis** via [ioredis](https://github.com/redis/ioredis)
- ✅ **Publicação em RabbitMQ** via [amqp-connection-manager](https://github.com/jwalton/node-amqp-connection-manager)
- ✅ **Logger Pino** estruturado (JSON) com redact de campos sensíveis
- ✅ **Graceful shutdown** (SIGTERM/SIGINT com timeout)
- ✅ **Validação Zod** no boot (fail-fast em env inválido)
- ✅ **100% de cobertura de testes** + typecheck + ESLint sem erros
- ✅ **SonarQube quality gate** configurado
- ✅ **Princípios SOLID, DRY e Clean Code** desde a primeira linha

---

## 🚀 Quick Start

### Pré-requisitos

- **Bun** ≥ 1.1 (dev/test) ou **Node.js** ≥ 20 (produção)
- **Docker** + **Docker Compose** (para subir PG/Redis/RabbitMQ localmente)
- Acesso ao `backend-node` rodando (ou suba a infra abaixo standalone)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

```bash
cp .env.example .env
# Edite as variáveis se necessário (DATABASE_URL, REDIS_HOST, RABBIT_URL, etc.)
```

### 3. Subir infraestrutura (opcional, se não usar a do backend-node)

```bash
make infra-up   # Sobe PostgreSQL, Redis e RabbitMQ via docker-compose
```

### 4. Gerar o Prisma Client

```bash
npm run prisma:gen
```

### 5. Rodar em modo dev (hot-reload)

```bash
make dev
```

Você deve ver, a cada minuto:

```
[HealthCheck 2026-06-15T12:00:00.000Z] postgres=up redis=up rabbitmq=disabled
```

Se `MESSAGING_ENABLED=true` no `.env`:

```
[HealthCheck 2026-06-15T12:00:00.000Z] postgres=up redis=up rabbitmq=up
```

---

## ➕ Como adicionar um novo job

O boilerplate vem com um **generator** que cria o job + teste + atualiza o
registro em 1 comando. Você só precisa implementar a lógica do `handle()`.

### 1. Gerar o esqueleto

```bash
# Forma curta
make job name=CleanupOldRecords

# Ou direto
bun run generate:job CleanupOldRecords

# Com schedule e description customizados
bun run generate:job CleanupOldRecords "0 3 * * *" "Remove registros com mais de 90 dias"

# Aceita qualquer formato de nome (kebab, snake, pascal)
bun run generate:job send-welcome-email    # vira SendWelcomeEmailJob
bun run generate:job sync_inventory       # vira SyncInventoryJob
```

O generator cria:
- `src/jobs/CleanupOldRecordsJob.ts` — classe estendendo `BaseJob`
- `tests/jobs/CleanupOldRecordsJob.test.ts` — 5 testes cobrindo 100% do esqueleto
- Atualiza `src/jobs/register-jobs.ts` adicionando o import e a instância na lista

### 2. Implementar a lógica

```ts
// src/jobs/CleanupOldRecordsJob.ts (gerado)
import { BaseJob, type JobContext } from '../core/BaseJob.js';

export class CleanupOldRecordsJob extends BaseJob {
  public readonly name = 'cleanup-old-records';
  public readonly schedule = '0 3 * * *';
  public readonly description = 'Remove registros com mais de 90 dias';

  protected async handle(context: JobContext): Promise<void> {
    context.logger.info({ event: 'job.cleanup-old-records.start' }, 'Iniciando limpeza');

    // sua lógica aqui — respeite context.signal para cancelamento via timeout
    // await PrismaService.getClient().$executeRaw`DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days'`;

    context.logger.info({ event: 'job.cleanup-old-records.done' }, 'Limpeza concluída');
  }
}
```

### 3. Validar

```bash
bun run test:coverage   # 100% statements/branches/functions/lines
bun run lint            # ESLint
```

Pronto. O scheduler cuida do resto: valida o cron, agenda, previne sobreposição,
aplica timeout via `AbortSignal`, loga início/fim/erro.

> **Quer escrever manualmente em vez de usar o generator?** Sem problema. Crie
> `src/jobs/MeuJob.ts` estendendo `BaseJob` e adicione manualmente em
> `src/jobs/register-jobs.ts`. Mas o generator garante 100% de cobertura do esqueleto
> de graça.

---

## 🏛️ Arquitetura

```
src/
├── app.ts                          # Bootstrap (conecta PG/Redis/Rabbit + inicia scheduler)
├── server.ts                       # Entry point (top-level await)
├── core/
│   ├── BaseJob.ts                  # Classe abstrata: name, schedule, handle(), run()
│   ├── Scheduler.ts                # Wrapper sobre node-cron (injetável)
│   └── index.ts
├── infra/
│   ├── database/
│   │   ├── PrismaService.ts        # Singleton Prisma (acesso ao DB do backend)
│   │   └── RedisProvider.ts        # Singleton ioredis
│   ├── messaging/
│   │   └── RabbitMQProvider.ts     # Publisher + check() de conexão
│   └── health/
│       └── DefaultHealthChecker.ts # Implementação padrão (PG + Redis + Rabbit)
├── jobs/
│   ├── HealthCheckJob.ts           # Exemplo: status dos 3 serviços a cada minuto
│   └── register-jobs.ts            # Registro central
└── shared/
    ├── config/env.ts               # Validação Zod de todas as envs
    ├── errors/AppError.ts          # Hierarquia de erros
    └── utils/
        ├── logger.ts               # Pino estruturado
        ├── shutdown.ts             # Graceful shutdown (SIGTERM/SIGINT)
        └── signals.ts              # createTimeoutSignal / timeoutPromise
```

### Fluxo de uma execução

```
cron tick (ex: a cada minuto)
   │
   ▼
Scheduler.execute(name)
   │  - se já rodando, skip (sem overlap)
   │  - cria AbortController com timeout (JOB_EXECUTION_TIMEOUT_MS)
   ▼
BaseJob.run(signal)
   │  - log: job.start
   ▼
handle({ logger, signal })
   │  - sua lógica aqui
   │  - respeite signal.throwIfAborted() se demorar
   ▼
log: job.success (ou job.error)
   │
   ▼
finally: clearTimeout, remove de `running`
```

### Fluxo de shutdown

```
SIGTERM/SIGINT
   │
   ▼
waitForRunningJobs()  ──►  stop() scheduler  ──►  disconnect RabbitMQ
                                              ──►  quit Redis
                                              ──►  $disconnect Prisma
                                              ──►  process.exit(0)
```

---

## 🔌 Conexão com o backend-node

Este serviço **NÃO** gerencia o schema do banco. Ele apenas conecta no mesmo
PostgreSQL/Redis/RabbitMQ que o `backend-node` já está rodando. Apontamentos:

| Variável | Aponta para |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL do `backend-node` (mesma `backend_node` database) |
| `REDIS_HOST` / `REDIS_PORT` | Redis do `backend-node` |
| `MESSAGING_ENABLED=true` + `RABBIT_URL` | RabbitMQ do `backend-node` |

> Se você subir a stack completa standalone, use `make infra-up` (sobe PG + Redis + Rabbit na porta 5432/6379/5672 com as credenciais padrão do backend-node).

---

## ⚙️ Variáveis de ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `ENVIRONMENT` | `local` | `local` / `development` / `test` / `production` |
| `LOG_LEVEL` | `info` | `fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent` |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Timeout do graceful shutdown antes de `process.exit(1)` |
| `JOB_EXECUTION_TIMEOUT_MS` | `300000` | Timeout por execução de job (5min) |
| `DATABASE_URL` | `postgresql://...` | Connection string do PostgreSQL |
| `DATABASE_POOL_MAX` | `20` | Tamanho máximo do pool de conexões |
| `DATABASE_POOL_IDLE_TIMEOUT` | `30000` | Timeout de conexões ociosas (ms) |
| `DATABASE_POOL_CONNECTION_TIMEOUT` | `5000` | Timeout para obter conexão (ms) |
| `DATABASE_QUERY_TIMEOUT` | `10000` | Timeout de query (ms) |
| `REDIS_HOST` | `localhost` | Host (ou URL `redis://...`) |
| `REDIS_PORT` | `6379` | Porta |
| `REDIS_PASSWORD` | `""` | Senha |
| `REDIS_DB` | `0` | Database number |
| `REDIS_COMMAND_TIMEOUT` | `5000` | Timeout de comandos (ms) |
| `MESSAGING_ENABLED` | `false` | Habilita RabbitMQ |
| `RABBIT_URL` | `amqp://localhost` | URL do RabbitMQ |
| `RABBIT_USER` | `guest` | Usuário |
| `RABBIT_PASSWORD` | `guest` | Senha |
| `RABBITMQ_PUBLISH_TIMEOUT` | `5000` | Timeout de publish (ms) |
| `HEALTH_CHECK_CRON` | `*/1 * * * *` | Cron do health check |
| `HEALTH_CHECK_ENABLED` | `true` | Liga/desliga o health check |

---

## 🧪 Qualidade de Código

```bash
npm run lint           # ESLint
npx tsc --noEmit       # Typecheck
bun run test:coverage  # 100% de cobertura obrigatória
```

Padrão: **100% statements · 100% branches · 100% functions · 100% lines** em `src/`.

O Husky roda os três automaticamente em pre-commit:

```bash
npx husky add .husky/pre-commit "npx tsc --noEmit && bun run lint && bun run test:coverage"
```

### SonarQube

Quality gate configurado em `sonar-project.properties`:

- `new_coverage >= 80%` (atualmente 100%)
- `new_duplicated_lines_density <= 3%`
- `new_security_hotspots_reviewed = 100%`
- `new_violations = 0`

Para subir o SonarQube local:

```bash
cd ../sonar-qube && make up   # porta 9000
```

Para escanear:

```bash
npx sonar-scanner
```

---

## 🐳 Docker

```bash
# Sobe apenas a app (assume que PG/Redis/Rabbit já rodam)
docker compose up -d app

# Ou sobe a stack completa isolada (PG + Redis + Rabbit + app)
make infra-up
docker compose up -d app
```

O `Dockerfile` é multi-stage e roda o `bun` como runtime.

---
