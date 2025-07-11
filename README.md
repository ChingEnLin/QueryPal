# QueryPal
### MongoDB AI Assistant for Azure Cosmos DB

This project is an intelligent database exploration tool tailored for developers and analysts working with **Azure Cosmos DB (MongoDB API)**. It allows users to inspect their NoSQL database schema and execute queries via **natural language** prompts using **Google Gemini AI**. Authentication and access control are managed securely with **Microsoft Entra ID (formerly Azure AD)**, and all Cosmos DB access happens through secure **On-Behalf-Of (OBO)** token exchange—**no connection strings are stored** in the codebase.

---

## 🚀 Motivation

Azure Cosmos DB (especially MongoDB API) lacks a friendly interface to inspect actual data schemas. The Azure Portal is often limited, buggy, and doesn't easily infer NoSQL structures. This tool provides:

- An intuitive interface to browse schema structure, document samples, and index info.
- A natural language interface using **Gemini API** to ask questions and generate MongoDB queries.
- Secure access architecture using **Microsoft Entra ID** and **OBO flow**, following best practices for enterprise apps.
- A privacy-conscious architecture: no credentials or database connection strings are exposed to the frontend.

---

## 🧱 Tech Stack

| Layer             | Technology                                                                 |
|------------------|-----------------------------------------------------------------------------|
| Frontend         | React, TypeScript, Tailwind CSS                                             |
| Authentication   | Microsoft Entra ID + MSAL (On-Behalf-Of Flow)                               |
| AI Query Engine  | Google Gemini.                                                              |
| Backend          | FastAPI (Python)                                                            |
| Database Access  | Azure Cosmos DB (MongoDB API)                                               |
| Cloud APIs       | Azure Resource Manager (ARM)                                                |
| Auth Libraries   | MSAL (Python, JS)                                                           |

---

## 🛠️ Architecture Overview

```
    ┌────────────────────┐      Login        ┌────────────────────┐
    │     Frontend       ├──────────────────►│   Microsoft Entra  │
    │ React + MSAL (SPA) │◄──────────────────┤     (Auth Server)  │
    └────────────────────┘   ID Token + OBO  └────────────────────┘
           │
           ▼ access_token
 ┌────────────────────────┐
 │    FastAPI Backend     │
 │   OBO Token Exchange   │◄──────────────┐
 │   Query Execution +    │               │
 │   Gemini AI Request    │               │
 └────────────────────────┘               │
           │                              │
           ▼                              │
 ┌────────────────────────┐               │
 │  Azure Cosmos DB API   │◄──────────────┘
 │ (MongoDB - ARM + conn) │
 └────────────────────────┘
```

- ✅ Authentication is handled using MSAL.
- 🔁 On-Behalf-Of (OBO) flow securely exchanges the frontend token to access Azure APIs.
- 🧠 Gemini API helps convert user questions into MongoDB queries.
- 🔍 The backend connects to Cosmos DB using runtime connection strings acquired via ARM API.

---


## 🐳 Containerization (Docker & Compose)

### Quick Start

1. Build and run both frontend and backend with Docker Compose:

   ```sh
   docker-compose up --build
   ```

   - The frontend will be available at http://localhost:3000
   - The backend API will be available at http://localhost:8000

2. Environment variables for the backend are managed via `.env.docker` (see below).

### Environment Variables

Create a `.env.docker` file in the project root (already provided):

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Azure Entra Auth
AZURE_TENANT_ID=xxxx-tenant-id
AZURE_CLIENT_ID=xxxx-backend-app-id
AZURE_CLIENT_SECRET=xxxx-client-secret
ARM_SCOPE=https://management.azure.com/.default
```

The `docker-compose.yml` is configured to load this file for the backend service.

### Manual Build/Run (Advanced)

You can also build and run each service separately:

#### Frontend
```sh
cd frontend
docker build -t querypal-frontend .
docker run -p 3000:80 querypal-frontend
```

#### Backend
```sh
cd backend
docker build -t querypal-backend .
docker run --env-file ../.env.docker -p 8000:8000 querypal-backend
```

---

## ☁️ Deployment to Google Cloud Run

### Prerequisites

- A GCP project with billing enabled
- Docker installed and configured
- Google Cloud CLI (`gcloud`) installed and authenticated
- Google Artifact Registry enabled and repository created (optional but recommended)

### Steps

#### 1. Build and Push Container Images

Build and push both frontend and backend images to Google Artifact Registry or Docker Hub:

```bash
# Backend
cd backend
docker build -t gcr.io/YOUR_PROJECT_ID/querypal-backend .
docker push gcr.io/YOUR_PROJECT_ID/querypal-backend

# Frontend
cd ../frontend
docker build -t gcr.io/YOUR_PROJECT_ID/querypal-frontend .
docker push gcr.io/YOUR_PROJECT_ID/querypal-frontend
```

#### 2. Deploy to Cloud Run

```bash
# Backend
gcloud run deploy querypal-backend \
  --image gcr.io/YOUR_PROJECT_ID/querypal-backend \
  --region europe-west1 \
  --port 8000 \
  --set-env-vars PORT=8000,GEMINI_API_KEY=xxx,AZURE_TENANT_ID=xxx,AZURE_CLIENT_ID=xxx,AZURE_CLIENT_SECRET=xxx,ARM_SCOPE=https://management.azure.com/.default \
  --allow-unauthenticated

# Frontend
gcloud run deploy querypal-frontend \
  --image gcr.io/YOUR_PROJECT_ID/querypal-frontend \
  --region europe-west1 \
  --port 4000 \
  --allow-unauthenticated
```

> 💡 Make sure the backend URL is correctly set in the frontend proxy or `.env` if needed.

#### 3. (Optional) Map Custom Domains

You can map your frontend and backend services to custom domains via:

```bash
gcloud run domain-mappings create --service querypal-frontend --domain frontend.example.com --region europe-west1
gcloud run domain-mappings create --service querypal-backend --domain api.example.com --region europe-west1
```

Follow the DNS instructions in the Cloud Console to complete the setup.

---

## ⚙️ Setup Instructions

### 1. Register Azure Entra ID Application

- Go to [Azure Portal – App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
- Register two applications:
  - **Frontend SPA**
    - Platform: Single-page application (SPA)
    - Redirect URI: `http://localhost:3000` (or your frontend URL)
    - Expose an API scope: `api://<backend-client-id>/access_as_user`
  - **Backend App**
    - Client type: Confidential client
    - Add a client secret
    - Add the frontend SPA as an authorized client for the exposed scope

- Add API permissions:
  - Microsoft Graph → `User.Read`
  - Azure Service Management → `user_impersonation`

- Grant Admin Consent.

- In Azure → Cosmos DB → IAM, give the backend app `Cosmos DB Account Reader Role`.

### 2. Environment Variables

Create a `.env` file for the backend:

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Azure Entra Auth
AZURE_TENANT_ID=xxxx-tenant-id
AZURE_CLIENT_ID=xxxx-backend-app-id
AZURE_CLIENT_SECRET=xxxx-client-secret
ARM_SCOPE=https://management.azure.com/.default
```

### 3. Frontend Config

Edit `authConfig.ts`:

```ts
export const msalConfig = {
  auth: {
    clientId: "<frontend-app-id>",
    authority: "https://login.microsoftonline.com/<tenant-id>",
    redirectUri: "http://localhost:3000"
  },
};

export const loginRequest = {
  scopes: ["User.Read", "api://<backend-client-id>/access_as_user"]
};
```

---

## ✨ Features

- 🔐 Authenticated access via Microsoft Entra ID
- 📦 View document schemas with recursive tree view
- 🔍 Sample document + index info
- 🧠 Natural language to query conversion (via Gemini AI)
- 🛡️ No connection strings stored; secure backend access only

---

## 📄 License

MIT
