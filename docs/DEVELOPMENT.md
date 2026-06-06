# Development Guide

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- Google Cloud SDK (for deployment)

### Git submodules

QueryPal uses `queryargus` as a git submodule under `backend/queryargus/`. After cloning, initialise it:

```bash
git submodule update --init --recursive
```

The submodule must be installed separately (its `pyproject.toml` pins `google-genai<1` which conflicts with the main requirements, so `--no-deps` is used):

```bash
cd backend
pip install --no-deps -e ./queryargus
```

This is required before running the backend locally or the test suite.

---

## Running Locally

### Docker Compose (recommended)

```bash
cp backend/.env.example backend/.env
# Fill in backend/.env with your credentials
docker-compose up --build
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

### Without Azure (mock mode)

Set `USE_MSAL_AUTH = false` in `frontend/app.config.ts`. All `dbService.ts` calls return mock data without hitting the backend or Azure.

### Manual (hot reload)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Backend `.env`

```env
GEMINI_API_KEY=
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
ARM_SCOPE=https://management.azure.com/.default
DB_USER=
DB_PASS=
DB_NAME=querypal
DB_HOST=localhost
DB_PORT=5432
# DB_UNIX_SOCKET=/cloudsql/project:region:instance  # Cloud SQL only
```

---

## Testing

### Backend

```bash
cd backend
pytest --cov=. --cov-report=term-missing   # with coverage
PYTHONPATH=. pytest tests/test_query_routes.py -v  # single file
make lint        # flake8
make format      # black --check
make format-fix  # black (auto-fix)
make typecheck   # mypy
make all         # install + lint + format + test
```

### Frontend

```bash
cd frontend
npm test              # watch mode
npm run test:run      # CI mode (run once)
npm run test:coverage # with coverage report
npm run test:ui       # interactive Vitest UI
```

---

## Code Style

- **Python**: Black (formatting), Flake8 (linting), MyPy (permissive type checking)
- **TypeScript**: ESLint, TypeScript strict mode
- **CSS**: No Tailwind — use CSS tokens from `frontend/src/design-tokens.css` and inline `style` props. See [DESIGN_HANDBOOK.md](../DESIGN_HANDBOOK.md).
- **Icons**: Inline SVGs only (`stroke="currentColor"`), no icon libraries.
- **Comments**: Only when the *why* is non-obvious. No docstrings or block comments explaining what the code does.
