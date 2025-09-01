# 🧠 QueryPal Backend API

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run/?git_repo=https://github.com/ChingEnLin/QueryPal&dir=backend)

The QueryPal backend is a robust, enterprise-grade FastAPI application that powers intelligent database operations through natural language processing. Built with Python 3.12 and modern async patterns, it provides secure, scalable access to Azure Cosmos DB with AI-powered query generation and analysis.

## 🚀 Key Features

- 🔐 **Enterprise Security**: Microsoft Entra ID authentication with On-Behalf-Of (OBO) token flow
- 🧠 **AI-Powered Queries**: Natural language to MongoDB translation using Google Gemini Pro
- 📊 **Intelligent Analytics**: Automatic data analysis with Chart.js visualization generation
- 💾 **Query Management**: Save, share, and collaborate on queries with team members
- 🔍 **Advanced Data Operations**: Full CRUD with pagination, filtering, and audit trails
- 🛡️ **Zero-Trust Architecture**: No hardcoded credentials, runtime connection string discovery
- ⚡ **High Performance**: Async operations, connection pooling, and intelligent caching
- 📚 **Comprehensive API**: RESTful endpoints with OpenAPI/Swagger documentation

---

## 📁 Project Architecture

```plaintext
backend/
├── main.py                         # FastAPI application entry point
├── routes/                         # API endpoint definitions
│   ├── azure.py                    # Azure Cosmos DB resource discovery
│   ├── query.py                    # Natural language query processing
│   ├── data_documents.py           # Document CRUD operations  
│   ├── user_queries.py             # Saved query management
│   └── system.py                   # Health checks & cache management
├── models/                         # Pydantic data models
│   ├── schemas.py                  # Core database schemas
│   ├── user_queries.py             # User query models
│   └── data_documents.py           # Document operation models
├── services/                       # Business logic layer
│   ├── azure_auth.py               # Microsoft Entra ID integration
│   ├── azure_cosmos_resources.py   # Azure ARM API client
│   ├── gemini_service.py           # Google Gemini AI integration
│   ├── mongo_service.py            # MongoDB operations
│   ├── pg_connection.py            # PostgreSQL connection management
│   ├── user_queries_service.py     # Query persistence layer
│   ├── data_documents_service.py   # Document management
│   └── analyze_service.py          # AI analysis & visualization
├── tests/                          # Comprehensive test suite
├── requirements.txt                # Python dependencies
├── pytest.ini                      # Test configuration
├── mypy.ini                        # Type checking configuration
├── pyproject.toml                  # Black formatting configuration
├── Dockerfile                      # Container configuration
└── README.md                       # This documentation
```

### 🏗️ Architectural Patterns

- **🔄 Repository Pattern**: Clean separation between data access and business logic
- **🛡️ Dependency Injection**: Modular, testable service composition
- **📊 CQRS-like Design**: Separate read/write operations for optimal performance
- **🔐 Security-First**: Token validation at every layer
- **⚡ Async-First**: Non-blocking I/O for high concurrency
---

## 🛠️ Quick Start

### Prerequisites
- **Python 3.12+**
- **PostgreSQL** (for user data storage)
- **Azure Cosmos DB** (MongoDB API)
- **Google Gemini API Key**
- **Azure Entra ID Application** (for authentication)

### Development Setup

```bash
# 1. Clone and navigate to backend
git clone https://github.com/ChingEnLin/QueryPal
cd QueryPal/backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your configuration (see below)

# 5. Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Google Gemini AI Configuration
GEMINI_API_KEY=your_google_gemini_api_key

# Microsoft Entra ID Configuration
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_CLIENT_ID=your_backend_app_client_id
AZURE_CLIENT_SECRET=your_backend_app_client_secret
ARM_SCOPE=https://management.azure.com/.default

# PostgreSQL Database (User Data)
DB_USER=querypal_user
DB_PASS=your_database_password
DB_NAME=querypal
DB_HOST=localhost
DB_PORT=5432

# Production: Cloud SQL Unix Socket (Google Cloud)
DB_UNIX_SOCKET=/cloudsql/project-id:region:instance-name

# Optional: Application Settings
DEBUG=False
LOG_LEVEL=INFO
```

### Database Setup

```bash
# Create PostgreSQL database and user
psql -U postgres
CREATE DATABASE querypal;
CREATE USER querypal_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE querypal TO querypal_user;

# The application will automatically create required tables
```

### 🚀 Running the Application

```bash
# Development with auto-reload
uvicorn main:app --reload

# Production deployment
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Using Docker
docker build -t querypal-backend .
docker run -p 8000:8000 --env-file .env querypal-backend
```

**API Documentation will be available at:**
- 📖 **Interactive Docs**: http://localhost:8000/docs
- � **ReDoc**: http://localhost:8000/redoc
- 🔗 **OpenAPI JSON**: http://localhost:8000/openapi.json

---

## 🧪 Testing & Quality Assurance

QueryPal backend maintains enterprise-grade code quality with comprehensive testing and static analysis.

### Quick Test Commands

```bash
# Run all tests and quality checks
./run_tests.sh

# Or using Make
make all
```

### Individual Test Categories

#### 🔬 Unit & Integration Tests
```bash
# Run full test suite with coverage
pytest --cov=. --cov-report=term-missing --cov-report=html

# Run specific test files
pytest tests/test_main.py -v
pytest tests/test_*_routes.py -v

# Run with specific markers
pytest -m "not integration" -v  # Skip integration tests
pytest -m "slow" -v             # Only slow tests
```

#### 📊 Code Coverage
- **Target**: 85%+ coverage maintained
- **Reports**: Generated in `htmlcov/` directory
- **CI Integration**: Coverage uploaded to Codecov

```bash
# Generate coverage report
pytest --cov=. --cov-report=html
open htmlcov/index.html  # View detailed coverage
```

#### 🔍 Static Code Analysis

```bash
# Code linting with flake8
flake8 . --statistics
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics

# Code formatting with black
black --check .          # Check formatting
black .                  # Apply formatting

# Type checking with mypy
mypy .                   # Full type checking
mypy --strict .          # Strict mode
```

### Test Structure & Coverage

```
tests/
├── conftest.py              # Pytest fixtures & configuration
├── test_main.py             # FastAPI app & middleware tests
├── test_schemas.py          # Pydantic model validation
├── test_system_routes.py    # System endpoints
├── test_query_routes.py     # Query processing endpoints
├── test_user_routes.py      # User query management
├── test_azure_routes.py     # Azure integration
└── test_*_service.py        # Service layer unit tests
```

**Current Coverage:**
- ✅ **Models & Schemas**: 95%+ coverage with validation tests
- ✅ **API Routes**: 85%+ coverage with mocked dependencies  
- ✅ **Service Layer**: 80%+ coverage with unit tests
- ✅ **Authentication Flow**: Complete token validation testing
- ✅ **Error Handling**: Comprehensive error scenario coverage

### Configuration Files

- **`pytest.ini`**: Test discovery, markers, and pytest settings
- **`mypy.ini`**: Type checking rules and exclusions
- **`pyproject.toml`**: Black code formatting configuration
- **`.flake8`**: Linting rules and style enforcement

### Continuous Integration

The test suite runs automatically on:
- ✅ **Pull Requests**: Full test suite + code quality checks
- ✅ **Push to Main**: Integration tests + deployment verification
- ✅ **Scheduled**: Daily dependency and security scanning

```yaml
# GitHub Actions workflow includes:
- Python 3.12 matrix testing
- PostgreSQL service containers
- Code coverage reporting
- Security vulnerability scanning
- Docker image building & testing
```


---

## 📡 API Reference

QueryPal backend provides a comprehensive REST API with full OpenAPI documentation.

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/validate` | Validate Azure access token | No |

### Azure Cosmos DB Discovery

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/azure/cosmos_accounts` | List accessible Cosmos DB accounts | Yes |
| `POST` | `/azure/account_details` | Get databases and collections for account | Yes |
| `POST` | `/azure/collection_info` | Get detailed collection metadata | Yes |

### Query Processing & AI

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/query/nl2query` | Convert natural language to MongoDB query | Yes |
| `POST` | `/query/execute` | Execute MongoDB query on specified database | Yes |
| `POST` | `/query/debug` | Get AI assistance for failed queries | Yes |
| `POST` | `/query/analyze` | AI analysis with visualization generation | Yes |

### Document Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/data/documents` | Get paginated documents with filtering | Yes |
| `PUT` | `/data/documents` | Update document by ID | Yes |
| `POST` | `/data/documents/insert` | Insert new document | Yes |
| `DELETE` | `/data/documents/{doc_id}` | Delete document by ID | Yes |
| `POST` | `/data/find_by_id` | Find document across collections | Yes |
| `POST` | `/data/clear_documents_cache` | Clear document lookup cache | Yes |

### User Query Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/user/queries` | List user's saved queries | Yes |
| `POST` | `/user/queries` | Save new query | Yes |
| `PUT` | `/user/queries/{query_id}` | Update existing query | Yes |
| `DELETE` | `/user/queries/{query_id}` | Delete saved query | Yes |

### System & Health

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Application health check | No |
| `POST` | `/system/clear-cache` | Clear all application caches | Yes |

### Sample API Requests

#### Natural Language to Query
```bash
curl -X POST "http://localhost:8000/query/nl2query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Find all active users from Canada",
    "db_context": {
      "name": "UserDB",
      "collections": [{"name": "users", "count": 5000}]
    },
    "collection_context": {
      "name": "users",
      "sampleDocument": {"name": "John", "country": "Canada", "status": "active"}
    }
  }'
```

#### Execute Query
```bash
curl -X POST "http://localhost:8000/query/execute" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "/subscriptions/.../cosmosdb-account",
    "database_name": "UserDB",
    "query": "db.users.find({\"country\": \"Canada\", \"status\": \"active\"})"
  }'
```

#### Analyze Results
```bash
curl -X POST "http://localhost:8000/query/analyze" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query_result": [
      {"name": "John", "country": "Canada", "age": 25},
      {"name": "Jane", "country": "Canada", "age": 30}
    ]
  }'
```

### Response Formats

All API responses follow a consistent structure:

**Success Response:**
```json
{
  "data": { /* response data */ },
  "status": "success",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request format",
    "details": { /* additional error context */ }
  },
  "status": "error",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Rate Limiting & Quotas

- **Authentication**: 100 requests/minute per user
- **Query Processing**: 50 requests/minute per user  
- **Data Operations**: 200 requests/minute per user
- **AI Services**: 25 requests/minute per user (Gemini API limits)

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_REQUIRED` | Authentication token required | 401 |
| `AUTH_INVALID` | Invalid or expired token | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Request validation failed | 422 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

---

## 🚀 Deployment

### Google Cloud Run (Recommended)

QueryPal backend is optimized for Google Cloud Run with automatic CI/CD:

#### Automatic Deployment
Push to the `production` branch triggers automatic deployment via GitHub Actions.

#### Manual Deployment
```bash
# 1. Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth configure-docker

# 2. Build and push container
docker build -t gcr.io/YOUR_PROJECT_ID/querypal-backend . --platform linux/amd64
docker push gcr.io/YOUR_PROJECT_ID/querypal-backend

# 3. Deploy to Cloud Run
gcloud run deploy querypal-backend \
  --image gcr.io/YOUR_PROJECT_ID/querypal-backend \
  --region europe-west1 \
  --port 8000 \
  --add-cloudsql-instances YOUR_PROJECT:REGION:INSTANCE \
  --set-env-vars AZURE_TENANT_ID=xxx,AZURE_CLIENT_ID=xxx,AZURE_CLIENT_SECRET=xxx,GEMINI_API_KEY=xxx,DB_UNIX_SOCKET=/cloudsql/YOUR_PROJECT:REGION:INSTANCE \
  --allow-unauthenticated
```

#### Environment Variables for Production
```bash
# Required for Cloud Run deployment
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id  
AZURE_CLIENT_SECRET=your_client_secret
ARM_SCOPE=https://management.azure.com/.default
GEMINI_API_KEY=your_gemini_key

# Database (Cloud SQL)
DB_USER=querypal_user
DB_PASS=your_db_password
DB_NAME=querypal
DB_UNIX_SOCKET=/cloudsql/project:region:instance

# Optional performance settings
WORKERS=4
MAX_CONNECTIONS=20
```

### Docker Deployment

```bash
# Build production image
docker build -t querypal-backend .

# Run with environment file
docker run -p 8000:8000 --env-file .env querypal-backend

# Run with Docker Compose (includes PostgreSQL)
docker-compose up --build
```

### Azure Container Instances

```bash
# Create resource group
az group create --name querypal-rg --location eastus

# Deploy container
az container create \
  --resource-group querypal-rg \
  --name querypal-backend \
  --image your-registry/querypal-backend:latest \
  --cpu 2 --memory 4 \
  --ports 8000 \
  --environment-variables AZURE_TENANT_ID=xxx GEMINI_API_KEY=xxx
```

### Health Checks & Monitoring

The backend includes comprehensive health monitoring:

```bash
# Health check endpoint
curl http://localhost:8000/health

# Detailed system status
curl http://localhost:8000/system/status
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "database": "connected",
    "azure_auth": "operational", 
    "gemini_api": "operational"
  },
  "version": "1.0.0",
  "uptime": "2 days, 3 hours"
}
```

---

## 🔧 Development Guidelines

### Code Style & Standards

```bash
# Code formatting (Black)
black --line-length 88 --target-version py312 .

# Import sorting (isort)
isort . --profile black

# Linting (flake8)
flake8 . --max-line-length=88 --extend-ignore=E203,W503

# Type checking (MyPy)
mypy . --strict --ignore-missing-imports
```

### Adding New Endpoints

1. **Define Pydantic Models** in `models/`
2. **Implement Service Logic** in `services/`
3. **Create Route Handlers** in `routes/`
4. **Add Comprehensive Tests** in `tests/`
5. **Update API Documentation**

### Performance Optimization

- **Database Connection Pooling**: Configured for optimal performance
- **Async/Await**: Use for all I/O operations
- **Caching**: Implement Redis for frequently accessed data
- **Query Optimization**: Index usage and efficient MongoDB queries
- **Rate Limiting**: Prevent abuse and ensure fair usage

### Security Best Practices

- **Token Validation**: Verify all incoming tokens
- **Input Sanitization**: Validate all user inputs
- **SQL Injection Prevention**: Use parameterized queries
- **CORS Configuration**: Restrict origins in production
- **Error Handling**: Don't expose internal details

---

## 🐛 Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Check token validation
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/validate

# Verify Azure configuration
echo $AZURE_TENANT_ID
echo $AZURE_CLIENT_ID
```

#### Database Connection Issues
```bash
# Test PostgreSQL connection
pg_isready -h localhost -p 5432

# Check Cloud SQL Proxy
./cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432

# Verify environment variables
echo $DB_USER $DB_NAME $DB_HOST
```

#### Gemini API Problems
```bash
# Test API key
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models

# Check quota limits
# Visit Google Cloud Console → APIs & Services → Quotas
```

### Debug Mode

Enable detailed logging for development:

```env
DEBUG=True
LOG_LEVEL=DEBUG
ENABLE_QUERY_LOGGING=True
```

### Performance Monitoring

Monitor application performance:

```python
# Add to main.py for development
import time
from starlette.middleware.base import BaseHTTPMiddleware

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
```

---

## 📚 Additional Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **Pydantic V2 Guide**: https://docs.pydantic.dev/latest/
- **Azure Entra ID**: https://docs.microsoft.com/en-us/azure/active-directory/
- **Google Gemini API**: https://ai.google.dev/docs
- **MongoDB Query Guide**: https://docs.mongodb.com/manual/tutorial/query-documents/

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## 👨‍💻 Author

**Built by [Ching-En Lin](https://github.com/ChingEnLin)**

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/ChingEnLin/QueryPal) or create an issue.

---

**🔗 Related Links:**
- [Frontend Documentation](../frontend/README.md)
- [API Documentation](http://localhost:8000/docs) (when running locally)
- [Deployment Guide](../docs/deployment.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
