# Linsiq Platform — Development Makefile

.PHONY: help install dev test lint format clean docker-build docker-up docker-down tf-init tf-plan tf-apply

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Local Development ---

install: ## Install backend dependencies
	cd backend && pip install -r requirements.txt

dev: ## Start development server with hot reload
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# --- Testing ---

test: ## Run all tests
	cd backend && pytest -v

test-cov: ## Run tests with coverage report
	cd backend && pytest -v --cov=. --cov-report=html --cov-report=term

# --- Linting & Formatting ---

lint: ## Run all linters (black, isort, flake8)
	cd backend && black --check .
	cd backend && isort --check-only .
	cd backend && flake8 . --max-line-length=100

format: ## Auto-format all Python code
	cd backend && black .
	cd backend && isort .

# --- Docker ---

docker-build: ## Build all Docker images
	docker-compose build

docker-up: ## Start all services with docker-compose
	docker-compose up -d

docker-down: ## Stop all services
	docker-compose down

docker-logs: ## View logs from all services
	docker-compose logs -f

# --- Terraform ---

tf-init: ## Initialize Terraform
	cd terraform && terraform init

tf-plan: ## Plan Terraform changes
	cd terraform && terraform plan

tf-apply: ## Apply Terraform changes
	cd terraform && terraform apply

tf-destroy: ## Destroy Terraform infrastructure
	cd terraform && terraform destroy

# --- Utility ---

clean: ## Remove Python cache and build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name ".coverage" -delete
	rm -rf backend/htmlcov backend/.pytest_cache

migrate: ## Run database migrations (auto-created on startup)
	cd backend && python -c "from db.database import engine, Base; Base.metadata.create_all(bind=engine)"

seed: ## Seed database with sample data
	@echo "Seeding not yet implemented. Add seed script here."
