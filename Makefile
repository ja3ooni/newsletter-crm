# AiLert Development Makefile
.PHONY: help setup dev-start dev-stop dev-reset dev-logs build test lint format clean deploy

# Default target
help: ## Show this help message
	@echo "AiLert Development Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# Development Environment
setup: ## Setup development environment
	@echo "🚀 Setting up development environment..."
	@chmod +x scripts/setup-dev.sh
	@./scripts/setup-dev.sh

dev-start: ## Start development services
	@echo "🚀 Starting development services..."
	@docker-compose up -d
	@echo "✅ Services started!"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo "🌐 API Gateway: http://localhost:8000"

dev-stop: ## Stop development services
	@echo "🛑 Stopping development services..."
	@docker-compose down

dev-reset: ## Reset development environment (removes all data)
	@echo "🔄 Resetting development environment..."
	@echo "⚠️  This will remove all data. Continue? [y/N]" && read ans && [ $${ans:-N} = y ]
	@docker-compose down -v
	@docker-compose up -d

dev-logs: ## View logs for all services
	@docker-compose logs -f

dev-logs-%: ## View logs for specific service (e.g., make dev-logs-user-service)
	@docker-compose logs -f $*

# Build and Test
build: ## Build all services
	@echo "🏗️ Building all services..."
	@docker-compose build

build-%: ## Build specific service (e.g., make build-user-service)
	@echo "🏗️ Building $*..."
	@docker-compose build $*

test: ## Run all tests
	@echo "🧪 Running all tests..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Testing $$service..."; \
			cd "$$service" && npm test -- --silent && cd ../..; \
		fi \
	done

test-%: ## Run tests for specific service (e.g., make test-user-service)
	@echo "🧪 Testing $*..."
	@cd services/$* && npm test -- --silent

test-integration: ## Run integration tests
	@echo "🧪 Running integration tests..."
	@npm run test:integration -- --silent

test-e2e: ## Run end-to-end tests
	@echo "🧪 Running E2E tests..."
	@npm run test:e2e -- --silent

# Code Quality
lint: ## Run linting for all services
	@echo "🔍 Linting all services..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Linting $$service..."; \
			cd "$$service" && npm run lint && cd ../..; \
		fi \
	done

lint-%: ## Run linting for specific service (e.g., make lint-user-service)
	@echo "🔍 Linting $*..."
	@cd services/$* && npm run lint

format: ## Format code for all services
	@echo "✨ Formatting all services..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Formatting $$service..."; \
			cd "$$service" && npm run format && cd ../..; \
		fi \
	done

format-%: ## Format code for specific service (e.g., make format-user-service)
	@echo "✨ Formatting $*..."
	@cd services/$* && npm run format

type-check: ## Run TypeScript type checking
	@echo "🔍 Type checking all services..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Type checking $$service..."; \
			cd "$$service" && npm run type-check && cd ../..; \
		fi \
	done

# Security
security-scan: ## Run security scans
	@echo "🔒 Running security scans..."
	@docker run --rm -v $(PWD):/app aquasec/trivy fs /app
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Security audit for $$service..."; \
			cd "$$service" && npm audit --audit-level=moderate && cd ../..; \
		fi \
	done

# Database
db-migrate: ## Run database migrations
	@echo "🗄️ Running database migrations..."
	@docker-compose exec user-service npm run db:migrate
	@docker-compose exec newsletter-service npm run db:migrate
	@docker-compose exec content-service npm run db:migrate
	@docker-compose exec crm-service npm run db:migrate
	@docker-compose exec analytics-service npm run db:migrate

db-seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	@docker-compose exec user-service npm run db:seed
	@docker-compose exec newsletter-service npm run db:seed
	@docker-compose exec content-service npm run db:seed
	@docker-compose exec crm-service npm run db:seed
	@docker-compose exec analytics-service npm run db:seed

db-reset: ## Reset database
	@echo "🔄 Resetting database..."
	@docker-compose exec postgres psql -U ailert -d ailert -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	@make db-migrate
	@make db-seed

# Monitoring
logs-prometheus: ## View Prometheus logs
	@docker-compose logs -f prometheus

logs-grafana: ## View Grafana logs
	@docker-compose logs -f grafana

metrics: ## Show system metrics
	@echo "📊 System Metrics:"
	@docker stats --no-stream

health: ## Check service health
	@echo "🏥 Health Check:"
	@curl -s http://localhost:8000/health | jq . || echo "API Gateway not responding"
	@curl -s http://localhost:3001/health | jq . || echo "User Service not responding"
	@curl -s http://localhost:3002/health | jq . || echo "Newsletter Service not responding"
	@curl -s http://localhost:3003/health | jq . || echo "Content Service not responding"
	@curl -s http://localhost:3004/health | jq . || echo "CRM Service not responding"
	@curl -s http://localhost:3005/health | jq . || echo "Analytics Service not responding"

# Cleanup
clean: ## Clean up Docker resources
	@echo "🧹 Cleaning up..."
	@docker-compose down -v --remove-orphans
	@docker system prune -f
	@docker volume prune -f

clean-images: ## Remove all Docker images
	@echo "🧹 Removing Docker images..."
	@docker rmi $(docker images -q) -f || true

clean-all: clean clean-images ## Complete cleanup

# Production
deploy-staging: ## Deploy to staging
	@echo "🚀 Deploying to staging..."
	@kubectl apply -f k8s/ --context=staging

deploy-prod: ## Deploy to production
	@echo "🚀 Deploying to production..."
	@kubectl apply -f k8s/ --context=production

# Documentation
docs: ## Generate documentation
	@echo "📚 Generating documentation..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Generating docs for $$service..."; \
			cd "$$service" && npm run docs && cd ../..; \
		fi \
	done

docs-serve: ## Serve documentation locally
	@echo "📚 Serving documentation..."
	@python3 -m http.server 8080 -d docs

# Development Utilities
shell-%: ## Open shell in service container (e.g., make shell-user-service)
	@docker-compose exec $* /bin/bash

psql: ## Connect to PostgreSQL
	@docker-compose exec postgres psql -U ailert -d ailert

redis-cli: ## Connect to Redis
	@docker-compose exec redis redis-cli -a ailert_redis_password

# Install dependencies
install: ## Install dependencies for all services
	@echo "📦 Installing dependencies..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Installing dependencies for $$service..."; \
			cd "$$service" && npm install && cd ../..; \
		fi \
	done
	@if [ -f "frontend/package.json" ]; then \
		echo "Installing frontend dependencies..."; \
		cd frontend && npm install && cd ..; \
	fi

update: ## Update dependencies for all services
	@echo "📦 Updating dependencies..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Updating dependencies for $$service..."; \
			cd "$$service" && npm update && cd ../..; \
		fi \
	done

# Git hooks
git-hooks: ## Setup Git hooks
	@echo "🪝 Setting up Git hooks..."
	@cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "✅ Git hooks installed"

# Infrastructure validation
validate: ## Validate infrastructure setup
	@echo "✅ Validating infrastructure..."
	@if [ -f "scripts/validate-infrastructure.sh" ]; then \
		chmod +x scripts/validate-infrastructure.sh && ./scripts/validate-infrastructure.sh; \
	else \
		echo "❌ Validation script not found"; \
	fi

# Performance testing
perf-test: ## Run performance tests
	@echo "⚡ Running performance tests..."
	@npm run test:performance

# Backup and restore
backup: ## Backup development data
	@echo "💾 Creating backup..."
	@mkdir -p backups
	@docker-compose exec postgres pg_dump -U ailert ailert > backups/postgres-$(shell date +%Y%m%d-%H%M%S).sql
	@echo "✅ Backup created"

restore: ## Restore from backup (specify BACKUP_FILE)
	@echo "📥 Restoring from backup..."
	@if [ -z "$(BACKUP_FILE)" ]; then echo "❌ Please specify BACKUP_FILE=path/to/backup.sql"; exit 1; fi
	@docker-compose exec -T postgres psql -U ailert -d ailert < $(BACKUP_FILE)
	@echo "✅ Backup restored"

# Quick development commands
quick-start: dev-start health ## Quick start with health check
	@echo "🚀 Quick start completed!"

quick-test: lint test ## Quick test (lint + unit tests)
	@echo "✅ Quick test completed!"

# Status and monitoring
status: ## Show service status
	@echo "📊 Service Status:"
	@docker-compose ps
	@echo ""
	@echo "📈 Resource Usage:"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
