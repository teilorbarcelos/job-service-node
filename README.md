# Advanced Node.js Backend API

Uma arquitetura robusta e modular construída com **Node.js**, **Fastify** e **TypeScript**, focada em alta performance, segurança escalável e uma experiência de desenvolvimento (DX) de elite. Boilerplate **production-ready** para iniciar qualquer projeto — monolito ou microsserviço.

---

## 🚀 Tecnologias Core

Stack de alto desempenho, com runtime intercambiável (Bun em dev/test, Node em produção):

- **Runtime:** [Bun](https://bun.sh/) (dev/test) · **Node.js** (produção)
- **Gerenciamento de deps:** **npm** (incompatível com `bun install` em Docker)
- **Framework:** [Fastify 5](https://fastify.dev/) — o web framework mais rápido para Node.js
- **ORM:** [Prisma 7](https://www.prisma.io/) com `driver-adapter-pg` (sem Prisma Engine, conexão direta via `pg`)
- **Banco:** PostgreSQL 15 (schemas `public` + `audit`)
- **Cache / Sessão / Rate Limit:** Redis 7
- **Mensageria:** RabbitMQ 3 via `amqp-connection-manager` (reconnect automático, publisher confirms, DLX/DLQ, prefetch=16, retry com backoff + circuit breaker)
- **Compressão HTTP:** `@fastify/compress` (Brotli + Gzip + Deflate, threshold 1KB)
- **Logger:** Pino estruturado com redact automático de campos sensíveis
- **Validação:** Zod (env schema com fail-fast no boot + fail-loud no dev)
- **Resiliência:** opossum (circuit breaker) + retry exponencial + timeouts configuráveis em todas as chamadas externas
- **Documentação:** Swagger / OpenAPI 3.0 (`/v1/docs`)
- **Métricas:** `prom-client` (`/metrics`) com métricas de negócio (logins, exports, mensageria, audit, health)
- **Testes:** Vitest 4 (100% cobertura + mutation testing com Stryker) + Testcontainers (PG + Redis)

---

## ✨ Funcionalidades

### 🔐 Segurança e Autenticação
- **JWT Hardening:** access token curto (15 min) + refresh token com rotação e *reuse detection* (invalida toda a família se um refresh já usado for reapresentado).
- **RBAC granular:** permissões por feature (`view`, `create`, `activate`, `delete`) e por role.
- **Sessões server-side em Redis:** invalidação instantânea de tokens ao desativar/atualizar usuário ou role.
- **CORS restritivo:** allowlist via `CORS_ORIGINS` em produção; permissivo apenas em dev/local.
- **Rate limit por endpoint:** login 5/min, password request 3/min, export/pdf 10/min, demais 100/min.
- **Validação de env no boot:** Zod schema; falha o startup se `JWT_SECRET < 32` chars em produção.
- **Helmet + CSP** ajustados para API (não serve HTML, então CSP é leve).

### 🏗️ Arquitetura Core
- **Base Components:** `BaseController`, `BaseService`, `BaseRepository` — CRUD + paginação + filtros dinâmicos + soft delete encapsulados.
- **Filtragem dinâmica:** busca textual, ranges de data, status active/inactive — declarativa nos schemas.
- **Soft delete:** `is_deleted` + `deleted_at` em todos os módulos, com anomização LGPD opcional.

### 🛡️ Resiliência e Observabilidade
- **Graceful shutdown:** `SIGTERM`/`SIGINT` com timeout configurável (`SHUTDOWN_TIMEOUT_MS`); fecha audit buffer, Prisma pools, Redis, RabbitMQ em ordem.
- **Health checks profundos:** `/health` pinga PG + Redis + RabbitMQ + PDF service (200/503); `/liveness` para K8s liveness probe. Métricas de health por serviço expostas no `/metrics`.
- **Correlation ID:** `X-Request-Id` em toda resposta; propagado via `AsyncLocalStorage` para chamadas externas (PDF, RabbitMQ).
- **Request-scoped logger:** logs Pino com `reqId`, `url`, `method` por request.
- **Audit pipeline assíncrono:** `AuditBuffer` com batch flush (200ms ou 50 itens) + backpressure (drop oldest se > 10k). Métrica de drops exposta.
- **Timeouts configuráveis em chamadas externas:** Redis (5s), RabbitMQ publish (5s), PDF (30s), DB queries (10s). Sinal de aborto propagado via `request.raw.signal` — se o cliente desconectar, operações são canceladas.
- **Bcrypt em worker thread:** hash/compare de senhas executado em `worker_threads` separada, sem bloquear o event loop. Fallback para execução direta em testes.
- **MIGRATE_ONLY=true (init-container):** separa migrations do boot, evita race condition em blue/green deployment.

### ⚡ Performance
- **Response Compression Brotli:** ~60% de redução em payloads JSON grandes (threshold 1KB).
- **Índices compostos no PostgreSQL:** `User(is_deleted+active)`, `Product(id_user+created_at)`, `Audit(id_user+created_at)`, `Audit(table_name)`, `ErrorLog(created_at)`.
- **Prisma pool tuning:** `max:20`, `idleTimeout:30s`, `connectionTimeout:5s` (env-overridable).
- **PDF streaming:** `GET /v1/user/export/pdf` usa stream do `fetch` direto pro cliente (zero memory footprint no backend).

### 🐳 DevOps e CI/CD
- **Multi-stage Dockerfile:** com `HEALTHCHECK` para K8s (interval 30s, timeout 3s, start-period 10s).
- **CI com dois jobs paralelos:**
  - `test` — suite completa com mocks (rápido)
  - `integration` — Testcontainers com PostgreSQL + Redis reais, migrations + seed via `prisma migrate deploy` + `prisma db seed`
- **SonarQube** quality gate (coverage ≥ 80%, violations = 0, security hotspots revisados).
- **Husky + lint-staged:** typecheck + lint + tests relacionados em pre-commit.

### 📝 Auditoria
- **Audit Logs Automáticos:** toda mutação persistida em schema `audit` (separado do principal), com host, IP, payload, diff, error.
- **Error logs:** exceções não tratadas gravadas em `tb_error_log` para análise.
- **Audit Explorer:** UI em `/admin/logs` com filtros por usuário, tabela, search.

### 📦 Storage Providers (Infrastructure Generation)
- **Multi-provider:** Local, AWS S3, Google Cloud Storage, Azure Blob Storage.
- **Generator CLI:** `make storage-driver name=s3` instala dependências, gera driver + testes com 100% de cobertura.

### 📄 PDF Service Integration
- **Streaming proxy:** o backend é só um proxy de stream do `react-pdf-service` (sem armazenar bytes).
- **Circuit breaker:** opossum no `PdfProvider` com retry exponencial — degradação graceful se o serviço cair.

### 📊 Métricas (Prometheus)
- **Endpoint `/metrics`:** requests, latência, status codes, health de process (CPU, memória, event loop lag).
- **Métricas de negócio:** logins/min (`business_logins_total`), exports/min (`business_exports_total`), mensagens pub/consume/min (`business_messages_published/consumed_total`), audit drops (`business_audit_drops_total`), health check por serviço (`business_health_check`).
- **Stack pré-configurada:** Prometheus + Grafana via `make metrics-up` com dashboards prontos incluindo todos os painéis de negócio.

---

## 🏗️ Arquitetura (Fluxo da Requisição)

```
Cliente → Fastify → onRequest (requestId + signal + log)
         → authenticate (JWT verify + Redis session)
         → rate-limit (Redis sliding window)
         → checkPermission (RBAC feature + action)
         → route handler (controller → service → repository → Prisma/Redis)
         → auditLogHook (buffer 200ms/50 itens → schema audit)
         → onResponse (métricas: latência, status, contadores)
         → Response compress (Brotli se > 1KB)
         → Cliente
```

Cada request carrega:
- **`X-Request-Id`** — correlation ID propagado via AsyncLocalStorage pra chamadas externas (PDF, RabbitMQ)
- **`request.raw.signal`** — se o cliente desconectar, operações em andamento são canceladas
- **`startTime`** — latência registrada no `/metrics`

---

## 🛠️ Guia de Desenvolvimento

### Fluxo Completo (primeira vez)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# Edite JWT_SECRET (mínimo 32 chars), DATABASE_URL, REDIS_HOST

# 3. Subir infraestrutura
make infra-up

# 4. Gerar Prisma Client + migrations
bun run prisma:gen
bun run prisma:dev

# 5. Rodar em dev com hot-reload
make dev
```

### Infraestrutura (Docker)
```bash
make infra-up       # Sobe Postgres, Redis e RabbitMQ
make infra-stop     # Para containers sem remover
make infra-down     # Para e remove
make infra-clean    # Remove volumes e imagens
make metrics-up     # Sobe Prometheus + Grafana
```

### Rodando
```bash
make dev            # Dev com hot-reload (Bun)
bun run src/server.ts  # Alternativa: rodar sem hot-reload
```

### Migrations
```bash
bun run prisma:gen          # Gera Prisma Client
bun run prisma:dev          # Cria/edita migration (dev)
bun run prisma:deploy       # Aplica migrations em prod
```

### Init-container (K8s)
```bash
MIGRATE_ONLY=true bun run src/server.ts   # Roda migrations e exit(0)
```

### API Examples (curl)

```bash
# Login
curl -X POST http://localhost:8888/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@email.com","password":"admin@123"}'
# → { "token": "...", "refreshToken": "...", "user": {...} }

# Listar usuários (paginação + filtros)
curl -H 'Authorization: Bearer <token>' \
  'http://localhost:8888/v1/user?page=1&perPage=10&active=true'

# Exportar PDF
curl -H 'Authorization: Bearer <token>' \
  'http://localhost:8888/v1/user/export/pdf' -o usuarios.pdf

# Health check
curl http://localhost:8888/health
# → { "status": "healthy", "checks": { "postgresql": true, "redis": true, ... } }

# Métricas
curl http://localhost:8889/metrics
```

### Troubleshooting

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| `ECONNREFUSED` no boot | Docker não está rodando | `make infra-up` |
| `JWT malformed` | `JWT_SECRET` muito curto em produção | Mínimo 32 caracteres |
| Login retorna 401 mesmo com senha correta | Redis fora do ar | `docker ps | grep redis` |
| PDF retorna mock | Serviço PDF não está rodando | Suba o `react-pdf-service` |
| `Missing rate limit headers` | Rate limit desligado | `RATE_LIMIT_ENABLED=true` no `.env` |
| Testes falham com erro de conexão | Docker não disponível no CI | Job `integration` exige Docker |

---

---

## 🔌 Modo Microsserviço (auth-service-node)

O `backend-node` pode delegar a autenticação para o `auth-service-node` (outro repositório),
um microsserviço dedicado que expõe `/v1/auth/*` na porta `8001`.

### Como ativar

```bash
# .env
AUTH_MODE=remote
```

Quando `AUTH_MODE=remote`:
- O `backend-node` **não registra** as rotas `/v1/auth/*` (login, refresh, logout, password reset)
- O middleware `authenticate`, o RBAC e a sessão Redis **continuam inalterados** (validam tokens do auth-service)
- O token JWT emitido pelo auth-service é aceito pelo monólito (mesmo `JWT_SECRET` compartilhado)

### Arquitetura

```
FRONTEND                   AUTH SERVICE (8001)         MONOLITH (8888)
   │                            │                          │
   ├─ POST /login ────────────→│                          │
   │                            ├── bcrypt verify          │
   │                            ├── Redis: create session  │
   │                            ├── JWT (HS256)            │
   │←── { token, refresh } ────│                          │
   │                                                      │
   ├─ GET /users (JWT) ────────────────────────────────→│
   │                          ├── valida JWT local        │
   │                          ├── checa Redis session     │
   │                          ├── RBAC check              │
   │←─────────────────────────────────────────────────────│
```

### O que muda

| Componente | `AUTH_MODE=local` (default) | `AUTH_MODE=remote` |
|---|---|---|
| `POST /v1/auth/login` | Handler local | ❌ Delegado ao auth-service (8001) |
| `POST /v1/auth/refresh` | Handler local | ❌ Delegado ao auth-service (8001) |
| `POST /v1/auth/logout` | Handler local | ❌ Delegado ao auth-service (8001) |
| `POST /v1/auth/password/*` | Handler local | ❌ Delegado ao auth-service (8001) |
| Middleware `authenticate` | ✅ Registrado | ✅ **Igual** |
| Middleware `checkPermission` | ✅ Registrado | ✅ **Igual** |
| Session version (Redis) | ✅ `session:user:{id}:*` | ✅ **Igual** |

### Compliance (E2E)

```bash
cd ../mage-backend-compliance

# Modo monolítico
cp .env.node .env
make test-node

# Modo microsserviço
cp .env.auth.node .env
make test-auth-node
```

---

## 🏗️ Geração de Módulos (CRUD Generator)

### 1. Definir o Modelo
Edite `prisma/main/schema.prisma`:
```prisma
model MyNewEntity {
  id          String   @id @default(uuid()) @db.VarChar(40)
  name        String
  description String?
  active      Boolean  @default(true)
  is_deleted  Boolean? @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  @@index([is_deleted, active])
}
```

### 2. Migration
```bash
npm run prisma:dev
```

### 3. Gerar Módulo
```bash
bun run generate MyNewEntity
```
Gera Controller, Service, Repository, Schema, Routes e **testes com 100% de cobertura** automaticamente.

---

## 🧪 Qualidade de Código

- **Testes:** `bun run test` (modo watch) · `bun run test:coverage` (valida 100% em statements, branches, functions, lines)
- **Mutation testing:** `npx stryker run` — valida se os testes realmente pegam bugs, não só se as linhas são executadas (~70% de mutation score)
- **Lint:** `bun run lint`
- **Typecheck:** `npx tsc --noEmit`
- **CI:** roda os três acima em cada PR para `main` ou `develop`
- **Pre-commit (Husky):** `npx tsc --noEmit` + `bun run lint` + `bun run test:coverage`

---

## 📖 Endpoints Úteis

| Endpoint | Descrição |
|----------|-----------|
| `/v1/docs` | Swagger UI |
| `/admin/logs` | Audit Explorer (UI) |
| `/metrics` | Prometheus |
| `/health` | Deep health check (PG + Redis + RabbitMQ + PDF) |
| `/liveness` | K8s liveness probe |
| `/v1/auth/login` · `/v1/auth/refresh` · `/v1/auth/me` · `/v1/auth/logout` | Autenticação |
| `/v1/user/export/pdf` | Streaming de PDF (protegido) |

---

## 📨 Mensageria (RabbitMQ)

Para ativar:
1. `MESSAGING_ENABLED=true` no `.env`
2. Configure `RABBIT_URL`, `RABBIT_USER`, `RABBIT_PASSWORD`
3. Use o `messagingProvider` em qualquer parte do código

**Funcionalidades:**
- **Circuit breaker no publish:** opossum com 50% de falha / 30s de reset. Se o broker cair, as chamadas são rejeitadas imediatamente sem travar a request.
- **Retry com backoff no consumer:** mensagens que falham são republicadas em exchange de retry com TTL crescente (1s → 5s → 30s → 5min). Após 5 tentativas, vão para DLQ.
- **Lifecycle do Fastify:** conexão é estabelecida no hook `onReady` e fechada no `onClose` — integrado ao ciclo de vida do servidor.
- **DLX/DLQ:** toda fila declarada via `publish()` ou `startConsumer()` tem `x-dead-letter-exchange: dlx`, com queue `dlq` consumível para auditoria de mensagens não processadas.

---

## ☁️ Storage Providers

```bash
make storage-driver name=s3      # AWS S3
make storage-driver name=gcs     # Google Cloud Storage
make storage-driver name=azure   # Azure Blob
```

Cada driver vem com **100% de cobertura de testes** e variáveis de ambiente já documentadas no `.env.example`.

---

## 🛡️ CI/CD

### SonarQube Quality Gate
- `new_coverage >= 80%`
- `new_duplicated_lines_density <= 3%`
- `new_security_hotspots_reviewed = 100%`
- `new_violations = 0`

### GitHub Actions
- `test` job: lint + typecheck + coverage com mocks
- `integration` job: Testcontainers (PG + Redis reais) + smoke test de conectividade

### Pre-commit (Husky)
- `npx tsc --noEmit`
- `bun run lint`
- `bun run test:coverage`
