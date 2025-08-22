#!/bin/bash

# Backend Test and Analysis Runner
# This script runs tests, linting, and static code analysis for the backend

set -e

echo "🧪 Running Backend Tests and Code Analysis"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pip install -r requirements.txt

echo -e "${YELLOW}🔍 Running static code analysis with flake8...${NC}"
flake8 . --statistics

echo -e "${YELLOW}🎨 Checking code formatting with black...${NC}"
black --check .

echo -e "${YELLOW}🧪 Running tests with pytest...${NC}"
PYTHONPATH=. pytest --cov=. --cov-report=term-missing --cov-report=html

echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "📊 Code coverage report generated in htmlcov/"
echo "🌐 Open htmlcov/index.html in your browser to view detailed coverage"
echo ""
echo "💡 For type checking, run: mypy . --ignore-missing-imports --no-strict-optional --allow-untyped-defs"