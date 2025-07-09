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
```

3. Run the App

uvicorn main:app --reload

API docs will be available at:
👉 http://localhost:8000/docs

⸻


## 📡 API Endpoints

| Method | Endpoint                   | Description                        |
|--------|----------------------------|------------------------------------|
| POST   | /query/nl2query            | NL2Query (natural language → query) |
| POST   | /query/execute             | Execute MongoDB query               |
| GET    | /azure/cosmos_accounts     | Get Cosmos Resources                |
| POST   | /azure/account_details     | Get Account Details                 |
| POST   | /azure/collection_info     | Get Collection Info                 |
| POST   | /system/clear_cache        | Clear All Caches                    |


⸻

## ✅ Next Ideas
	•	Sandbox query execution.
	•	Integrate OpenAI or Claude as fallback NLP engines.

⸻

## 👨‍💻 Author

Built by Ching-En Lin · Powered by Microsoft Azure and Google Gemini.
