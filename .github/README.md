# QueryPal CI/CD Pipeline

This directory contains the GitHub Actions CI/CD workflows for the QueryPal project.

## Workflows

### `ci.yml` - Continuous Integration

This workflow runs on pushes and pull requests to the `main`, `dev`, and `develop` branches.

**Jobs:**

1. **Backend Tests (Python)**
   - Sets up Python 3.12
   - Installs dependencies with pip caching
   - Runs syntax checks with flake8
   - Runs full linting with flake8 (non-blocking warnings)
   - Checks code formatting with black
   - Runs tests with pytest and coverage
   - Uploads coverage to Codecov

2. **Frontend Tests (Node.js)**
   - Sets up Node.js 20
   - Installs dependencies with npm caching
   - Runs tests with coverage using Vitest
   - Uploads coverage to Codecov

3. **Build Verification**
   - Runs after both test jobs pass
   - Builds the frontend application
   - Verifies build artifacts are created

**Coverage Reports:**
- Backend and frontend coverage reports are uploaded to Codecov with separate flags
- Coverage failures are non-blocking to allow builds to continue

**Key Features:**
- Parallel execution of frontend and backend tests
- Dependency caching for faster builds
- Comprehensive code quality checks
- Build verification to catch integration issues

## Running Tests Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
flake8 . --statistics
black --check .
PYTHONPATH=. pytest --cov=. --cov-report=term-missing --verbose
```

### Frontend
```bash
cd frontend
npm install
npm run test:coverage
npm run build
```

## Coverage Requirements

The CI pipeline generates coverage reports but does not enforce minimum coverage thresholds. This allows for flexible development while still providing visibility into test coverage.

- Backend: Currently ~49% coverage
- Frontend: Currently ~13% coverage (mainly utilities and tested components)

Coverage reports are available in:
- Backend: `backend/htmlcov/index.html`
- Frontend: `frontend/coverage/index.html`