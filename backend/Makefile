# Backend Makefile for testing and code analysis

.PHONY: help install test lint format typecheck all clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install all dependencies
	pip install -r requirements.txt

test: ## Run tests with coverage
	PYTHONPATH=. pytest --cov=. --cov-report=term-missing --cov-report=html

lint: ## Run flake8 linting
	flake8 . --statistics

format: ## Check code formatting with black
	black --check .

format-fix: ## Fix code formatting with black
	black .

typecheck: ## Run type checking with mypy (permissive mode)
	mypy . --ignore-missing-imports --no-strict-optional --allow-untyped-defs

all: install lint format test ## Run all checks and tests (except type checking)

clean: ## Clean up generated files
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf __pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -name "*.pyc" -delete
	find . -name ".coverage" -delete