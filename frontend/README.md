# QueryPal - Secure Edition

QueryPal is an intelligent, AI-powered assistant that helps users perform database operations using natural language. This version is designed with a secure, enterprise-ready architecture that dynamically discovers and connects to databases the authenticated user has access to.

The application uses **Google Gemini API** for its natural language processing and **Azure Entra ID** for user authentication, communicating with a **secure backend service** that handles all sensitive operations.

## Secure Architecture: Backend-for-Frontend (BFF)

This application follows a Backend-for-Frontend (BFF) pattern. The React frontend **never** handles database credentials or makes direct calls to cloud management APIs. All sensitive operations are delegated to a backend API that you create.

### Authentication Flow

1.  **Frontend Login**: The user signs into the React app using MSAL, authenticating against Azure Entra ID. The frontend receives an **access token** scoped for your backend API.
2.  **API Calls**: For any operation (like listing databases or running a query), the frontend calls your backend API, including the user's access token in the `Authorization` header.
3.  **Backend Verification**: Your backend validates the access token to ensure the request is from an authenticated user.
4.  **On-Behalf-Of Flow (OBO)**: To interact with Azure (e.g., to find the user's Cosmos DB resources), the backend uses the **On-Behalf-Of flow**. It exchanges the user's access token for a new token that allows the backend to call the Azure Resource Manager (ARM) API *on behalf of the user*. This ensures your backend can only see resources the user is permitted to see.
5.  **Secure Operations**: The backend uses its own secure identity (e.g., a Service Principal or Managed Identity) with appropriate permissions to connect to databases and execute queries. **Connection strings are never exposed to the frontend.**

This pattern is critical for security and compliance, preventing exposure of sensitive credentials to the browser.

## Getting Started

### Prerequisites

- An **Azure account** with an active subscription and permissions to register applications.
- A **backend service** built to conform to the API Contract defined below. This backend will handle the OBO flow and database interactions.

### Frontend Setup

1.  **Clone the repository.**
2.  **Configure Authentication (`authConfig.ts`)**:
    -   In the Azure Portal, create an **App registration** for your frontend.
    -   Under "Redirect URI", add a **Single-page application (SPA)** entry for `http://localhost:8080`.
    -   Copy the **Application (client) ID** and **Directory (tenant) ID**.
    -   Paste them into the `clientId` and `authority` fields in `authConfig.ts`.
    -   In your App Registration, go to **API permissions**. You must grant consent to an API scope exposed by your backend service.
3.  **Run the application** using a local server like `http-server`.

## API Contract

Your backend service must implement the following endpoints. All endpoints should be protected and require a valid Bearer token from the authenticated user.

---

### `GET /api/azure/resources`

Discovers Cosmos DB accounts and databases the user has access to.

-   **Success Response (200):** An array of discovered resources.
    ```json
    [
      {
        "id": "/subscriptions/sub-id/...",
        "name": "prod-account",
        "databases": [{ "name": "main_db" }, { "name": "audit_db" }]
      },
      {
        "id": "/subscriptions/sub-id/...",
        "name": "staging-account",
        "databases": [{ "name": "test_db" }]
      }
    ]
    ```

---

### `POST /api/connect`

Establishes a connection context on the backend and returns database metadata.

-   **Request Body:**
    ```json
    {
      "accountName": "prod-account",
      "databaseName": "main_db"
    }
    ```
-   **Success Response (200):**
    ```json
    {
      "name": "main_db",
      "collections": ["users", "products", "orders"],
      "totalDocuments": 125000,
      "size": "15.7 GB"
    }
    ```

---

### `POST /api/collection-info`

Fetches detailed information for a specific collection.

-   **Request Body:**
    ```json
    {
        "accountName": "prod-account",
        "databaseName": "main_db",
        "collectionName": "users"
    }
    ```
-   **Success Response (200):**
    ```json
    {
      "name": "users",
      "documentCount": 50000,
      "averageDocumentSize": "2.1 KB",
      "indexes": ["_id_", "email_1"],
      "sampleDocument": {
        "_id": { "$oid": "6c5babe1a3f5a5d5c5d5e1f3" },
        "lastLogin": { "$date": "2024-05-20T10:00:00Z" }
      }
    }
    ```
---

### `POST /api/generate-query`

Generates a query using the Gemini API, providing database schema for context.

-   **Request Body:**
    ```json
    {
      "userInput": "A natural language prompt from the user.",
      "dbContext": { ...DbInfo } // Optional: context of the connected database
    }
    ```
-   **Success Response (200):** `QueryResultData` object.

---

### `POST /api/run-query`

Executes a query against the specified database.

-   **Request Body:**
    ```json
    {
      "accountName": "prod-account",
      "databaseName": "main_db",
      "query": "db.collection('users').find({})"
    }
    ```
-   **Success Response (200):** Query result from the database.
---

## Disclaimer

This is a demonstration application. Do not use it with production databases or sensitive data without a thorough security review of both the frontend and your backend implementation.