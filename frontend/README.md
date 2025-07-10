# QueryPal - Secure Edition

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run/?git_repo=https://github.com/celinlin/QueryPal&dir=frontend)

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

### `GET /api/azure/azure_accounts`

Discovers the Cosmos DB accounts the user has access to.

-   **Success Response (200):** An array of discovered accounts.
    ```json
    [
      {
        "id": "/subscriptions/sub-id/resourceGroups/rg-prod/...",
        "name": "prod-ecommerce-db"
      },
      {
        "id": "/subscriptions/sub-id/resourceGroups/rg-staging/...",
        "name": "staging-cms-db"
      }
    ]
    ```

---

### `POST /api/azure/account_details`

Fetches detailed information for all databases within a specific account.

-   **Request Body:**
    ```json
    {
      "accountId": "/subscriptions/sub-id/resourceGroups/rg-prod/..."
    }
    ```
-   **Success Response (200):** An array of database details (`DbInfo` objects).
    ```json
    [
      {
        "name": "ECommerce-DB",
        "collections": [
          { "name": "users", "count": 5000 },
          { "name": "products", "count": 10000 },
          { "name": "orders", "count": 500 }
        ],
        "totalDocuments": 15500,
        "size": "256 MB"
      },
      {
        "name": "Analytics-DB",
        "collections": [
          { "name": "pageViews", "count": 400000 },
          { "name": "userEvents", "count": 100000 }
        ],
        "totalDocuments": 500000,
        "size": "1.2 GB"
      }
    ]
    ```

---

### `POST /api/azure/collection_info`

Fetches detailed information for a specific collection.

-   **Request Body:**
    ```json
    {
        "account_id": "/subscriptions/sub-id/resourceGroups/rg-prod/...",
        "database_name": "ECommerce-DB",
        "collection_name": "users"
    }
    ```
-   **Success Response (200):** A `CollectionInfo` object.
    ```json
    {
      "name": "users",
      "documentCount": 5000,
      "averageDocumentSize": "1.2 KB",
      "indexes": ["_id_", "email_1"],
      "sampleDocument": { ... }
    }
    ```
---

### `POST /api/query/nl2query`

Generates a query using the Gemini API, providing database schema for context.

-   **Request Body:**
    ```json
    {
      "userInput": "A natural language prompt from the user.",
      "dbContext": { ...DbInfo } // Optional: context of the connected database
      "collectionContext": { ...CollectionInfo } // Optional: context of the specific collection
    }
    ```
-   **Success Response (200):** An object containing the generated code string.
    ```json
    {
      "generated_code": "db.collection('users').find({ status: 'active' })"
    }
    ```

---

### `POST /api/query/execute`

Executes a query against the specified database.

-   **Request Body:**
    ```json
    {
      "accountId": "/subscriptions/sub-id/resourceGroups/rg-prod/...",
      "databaseName": "ECommerce-DB",
      "query": "db.collection('users').find({})"
    }
    ```
-   **Success Response (200):** Query result from the database.

---

### `POST /api/query/debug`

Sends a failed query to the AI for debugging analysis.

-   **Request Body:**
    ```json
    {
      "query": "db.collection('users').find({}).sor({ name: 1 })",
      "error_message": "pymongo.errors.OperationFailure: ... unknown operator: $sor"
    }
    ```
-   **Success Response (200):** An object containing the AI's suggestion.
    ```json
    {
      "suggestion": "The error indicates an unknown operator '$sor'. The correct sort operator in MongoDB is '$sort'. Try replacing '$sor' with '$sort' in your query."
    }
    ```

---

### `POST /api/system/clear-cache`

Clears any server-side caches related to Azure resources.

-   **Request Body:** None.
-   **Success Response (200):** A confirmation message.
    ```json
    {
      "message": "Cache cleared successfully."
    }
    ```

---

## Disclaimer

This is a demonstration application. Do not use it with production databases or sensitive data without a thorough security review of both the frontend and your backend implementation.