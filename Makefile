.PHONY: install dev test coverage generate storage-driver infra-up infra-stop infra-down infra-clean metrics-up metrics-stop metrics-down

# Variáveis
ENVIRONMENT ?= development

install:
	@echo "📦 Instalando dependências (npm)..."
	@npm install

dev:
	@echo "🚀 Iniciando servidor de desenvolvimento (Bun)..."
	@bun run dev

test:
	@echo "🧪 Executando testes unitários e de integração (Mocks)..."
	@bun run test

coverage:
	@echo "📊 Gerando relatório de cobertura de código..."
	@bun run test:coverage
	@echo "\n--- Resumo de Cobertura ---"
	@echo "Verifique os detalhes acima. Se houver linhas não cobertas, elas estarão listadas na tabela."

# Geradores
# Exemplo: make generate name=Product
generate:
	@bun run generator/index.ts $(name)

# Exemplo: make storage-driver name=s3
storage-driver:
	@bun run generator/install-storage.ts $(name)

# Infraestrutura
infra-up:
	@echo "🐳 Subindo infraestrutura local (Docker)..."
	@bun run infra:up

infra-stop:
	@echo "🛑 Parando serviços da infraestrutura..."
	@bun run infra:stop

infra-down:
	@echo "🗑️ Removendo containers da infraestrutura..."
	@bun run infra:down

infra-clean:
	@echo "🧹 Limpeza completa da infraestrutura (Volumes & Imagens)..."
	@bun run infra:clean

# Métricas (Prometheus & Grafana)
metrics-up:
	@echo "📈 Subindo stack de métricas (Prometheus & Grafana)..."
	@bun run metrics:up

metrics-stop:
	@echo "🛑 Parando stack de métricas..."
	@bun run metrics:stop

metrics-down:
	@echo "🗑️ Removendo stack de métricas..."
	@bun run metrics:down
