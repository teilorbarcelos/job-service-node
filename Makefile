.PHONY: install dev test coverage generate-job infra-up infra-stop infra-down infra-clean

ENVIRONMENT ?= development

install:
	@echo "📦 Instalando dependências (npm)..."
	@npm install

dev:
	@echo "🚀 Iniciando job runner (Bun, hot-reload)..."
	@bun run dev

test:
	@echo "🧪 Executando testes unitários..."
	@bun run test

coverage:
	@echo "📊 Gerando relatório de cobertura de código..."
	@bun run test:coverage
	@echo "\n--- Resumo de Cobertura ---"
	@echo "Verifique os detalhes acima. Se houver linhas não cobertas, elas estarão listadas na tabela."

# Exemplo: make generate-job name=CleanupOldRecords
generate-job:
	@echo "✏️  Crie manualmente src/jobs/$(name).ts estendendo BaseJob e registre em src/jobs/register-jobs.ts"

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
