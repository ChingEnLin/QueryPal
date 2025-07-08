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
├── main.py                     # FastAPI app entry point
├── api/
│   └── routes/
│       ├── db.py               # Endpoints for DB config & connect
│       └── query.py            # Endpoints for NL query and execution
├── models/
│   ├── schemas.py              # Pydantic models
│   └── config.py               # DB connection list
├── services/
│   ├── gemini_service.py       # Gemini API integration
│   └── mongo_service.py        # MongoDB connection & query logic
├── .env                        # Gemini API key
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
2. Add your Gemini API Key

Create a .env file and add:

GEMINI_API_KEY=your_google_gemini_api_key

3. Run the App

uvicorn main:app --reload

API docs will be available at:
👉 http://localhost:8000/docs

⸻

📡 API Endpoints

Method	Endpoint	Description
GET	/db/available-databases	Returns list of DB configs
POST	/db/connect	Checks MongoDB connection
POST	/query/nl2query	Converts natural language to query
POST	/query/execute	Executes generated MongoDB query


⸻

⚠️ Security Notes
	•	MongoDB eval() is unsafe — use in controlled environment only. For production, implement a secure query parser or query builder.
	•	Keep your .env file safe and never expose Gemini API key to frontend.

⸻

🧪 Sample .env

GEMINI_API_KEY=AIzaSyXXX...your_key_here


⸻

✅ Next Ideas
	•	Add JWT or Azure Entra ID authentication.
	•	Sandbox query execution.
	•	Integrate OpenAI or Claude as fallback NLP engines.

⸻

👨‍💻 Author

Built by Ching-En Lin · Powered by Microsoft Azure and Google Gemini.
