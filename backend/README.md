# 🧠 MongoDB Natural Language Query Backend

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run/?git_repo=https://github.com/celinlin/QueryPal&dir=backend)

This is a modular FastAPI backend that powers a web application allowing users to perform MongoDB operations using natural language, powered by Google Gemini.

## 🚀 Features

- 🔐 **Secure Gemini API usage** — credentials are kept on the backend.
- 💬 **Natural language to MongoDB query translation** using Gemini API.
- ⚙️ **MongoDB query execution** after user confirmation.
- 🌐 **Modular FastAPI structure** for scalability and clarity.
- 🔄 **CORS enabled** for easy frontend integration.

---

## 📁 Project Structure

```plaintext
backend/
├── main.py                         # FastAPI app entry point
├── routes/
│   ├── azure.py                    # Endpoints for Azure Cosmos DB discovery
│   ├── query.py                    # Endpoints for NL query and execution
│   └── system.py                   # System health check and cache management
├── models/
│   └── schemas.py                  # Pydantic models
├── services/
│   ├── azure_cosmos_resources.py   # Azure ARM API integration
│   ├── gemini_service.py           # Gemini API integration
│   └── mongo_service.py            # MongoDB connection & query logic
├── .env                            # Environment variables
├── requirements.txt                # Python dependencies
└── README.md                       # Project documentation
```
---

## 🛠️ Setup Instructions

### 1. Clone & Setup Environment

```bash
git clone https://your-repo-url
cd backend
python -m venv venv
source venv/bin/activate  # or venv\\Scripts\\activate on Windows
pip install -r requirements.txt
```

2. Add your Gemini API Key and Azure Entra ID credentials to the `.env` file:

```plaintext
GEMINI_API_KEY=your_google_gemini_api_key
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
ARM_SCOPE=https://management.azure.com/.default
GEMINI_API_KEY=your_google_gemini_api_key

DB_USER=querypal-user
DB_PASS=your_db_password
DB_NAME=querypal
DB_HOST=127.0.0.1
```

3. Run the App

uvicorn main:app --reload

API docs will be available at:
👉 http://localhost:8000/docs

⸻

## 🧪 Testing and Code Quality

This project includes comprehensive testing and static code analysis tools to ensure code quality and reliability.

### Running Tests

#### Quick Start
```bash
# Run all tests and code analysis
./run_tests.sh

# Or using Make
make all
```

#### Individual Commands

##### 1. Install Dependencies
```bash
pip install -r requirements.txt
# or
make install
```

##### 2. Run Tests
```bash
# Run tests with coverage report
pytest --cov=. --cov-report=term-missing --cov-report=html
# or
make test
```

##### 3. Code Linting
```bash
# Check code style with flake8
flake8 . --statistics
# or
make lint
```

##### 4. Code Formatting
```bash
# Check formatting with black
black --check .

# Apply formatting
black .
# or
make format-fix
```

##### 5. Type Checking
```bash
# Run type checking with mypy
mypy .
# or
make typecheck
```

### Test Coverage

The test suite currently covers:
- ✅ Main FastAPI application structure and CORS
- ✅ All Pydantic models and schema validation
- ✅ System routes (cache management)
- ✅ Query routes (mocked external dependencies)
- ✅ Authentication and authorization flow

Coverage report is generated in `htmlcov/` directory. Open `htmlcov/index.html` in your browser to view detailed coverage.

### Static Code Analysis

The project uses multiple tools for code quality:
- **flake8**: PEP 8 style guide enforcement
- **black**: Automatic code formatting
- **mypy**: Static type checking
- **pytest**: Testing framework with coverage reporting

### Test Structure

```
tests/
├── conftest.py           # Test configuration and fixtures
├── test_main.py          # FastAPI app tests
├── test_schemas.py       # Pydantic model tests
├── test_system_routes.py # System endpoint tests
└── test_query_routes.py  # Query endpoint tests (mocked)
```

### Configuration Files

- `pytest.ini` - Pytest configuration
- `.flake8` - Flake8 linting rules
- `mypy.ini` - MyPy type checking settings
- `pyproject.toml` - Black formatting configuration

⸻


## 📡 API Endpoints

| Method | Endpoint                   | Description                        |
|--------|----------------------------|------------------------------------|
| POST   | /query/nl2query            | NL2Query (natural language → query) |
| POST   | /query/execute             | Execute MongoDB query               |
| POST   | /query/debug               | Debug Query (failed query → suggestion) |
| GET    | /azure/cosmos_accounts     | Get Cosmos Resources                |
| POST   | /azure/account_details     | Get Account Details                 |
| POST   | /azure/collection_info     | Get Collection Info                 |
| POST   | /system/clear_cache        | Clear All Caches                    |
| GET    | /user/queries                 | List all saved queries for user   |
| POST   | /user/queries                 | Save a new query for user         |
| PUT    | /user/queries/{queryId}       | Update an existing saved query    |
| DELETE | /user/queries/{queryId}       | Delete a saved query              |

⸻

## ✅ Next Ideas
	•	Sandbox query execution.
	•	Integrate OpenAI or Claude as fallback NLP engines.

⸻

## 👨‍💻 Author

Built by Ching-En Lin · Powered by Microsoft Azure and Google Gemini.
