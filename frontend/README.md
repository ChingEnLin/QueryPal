# QueryPal

QueryPal is an intelligent, AI-powered assistant that helps users perform MongoDB database operations using natural language. It generates executable MongoDB queries from plain English requests, provides a summary for verification, and allows direct execution against a connected database.

This application is powered by the **Google Gemini API** for its natural language processing capabilities and uses **Azure Entra ID (Azure AD)** for user authentication.

## Features

- **Secure Authentication**: User sign-in is handled through Microsoft's identity platform (Azure Entra ID).
- **Natural Language to MongoDB Query**: Convert commands like "find all active users from Canada" into executable MongoDB queries.
- **Database & Collection Explorer**: Connect to different databases and browse their collections.
- **Inferred Schema Viewer**: Click on a collection to view an automatically generated schema from a sample document, showing field names and data types (including `ObjectId`, `Date`, etc.).
- **Editable & Executable Queries**: Edit the AI-generated code directly in the browser and run it against the connected database.
- **Safe & Interactive Workflow**: The AI provides an intent summary and a confirmation prompt, ensuring you understand the operation before running it.
- **Responsive Design**: A clean, modern UI that works on various screen sizes.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Authentication**: Microsoft Authentication Library (MSAL) for React (`@azure/msal-react`)
- **AI**: Google Gemini API
- **State Management**: React Context API
- **Module Loading**: ES Modules with `importmap`

## Getting Started

### Prerequisites

- An **Azure account** with an active subscription.
- [Node.js](https://nodejs.org/) (LTS version recommended)
- A package manager like `npm` or `yarn`
- A local development server. We recommend `http-server`.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd querypal
    ```

2.  **Authentication Setup (Azure Entra ID)**:
    You must register an application in your Azure tenant to get a `clientId` and `tenantId`.

    -   Navigate to the **Azure Portal** and open the **Microsoft Entra ID** service.
    -   Go to **App registrations** and select **New registration**.
    -   Give your application a name (e.g., `QueryPalApp`).
    -   For "Supported account types," choose the option that fits your needs (e.g., "Accounts in this organizational directory only").
    -   Under "Redirect URI", select **Single-page application (SPA)** and enter the URL where your app will run. For local development, this is typically `http://localhost:8080`.
    -   Click **Register**.
    -   Once created, copy the **Application (client) ID** and **Directory (tenant) ID** from the app's overview page.
    -   Open the `authConfig.ts` file in the project's root directory.
    -   Replace the placeholder values for `clientId` and `tenantId` with the ones you copied.

    ```ts
    // In authConfig.ts
    export const msalConfig: Configuration = {
        auth: {
            clientId: "PASTE_YOUR_CLIENT_ID_HERE",
            authority: "https://login.microsoftonline.com/PASTE_YOUR_TENANT_ID_HERE",
            // ...
        },
        // ...
    };
    ```

3.  **Install a simple server:**
    ```bash
    npm install -g http-server
    ```

4.  **Backend Setup:**
    This frontend application is designed to communicate with a backend server that handles database connections and secure calls to the Google Gemini API. **You will need to create this backend.** For secure endpoints, your backend should validate the ID token sent by the frontend after successful authentication.

5.  **Running the Frontend:**
    Start the local development server from the project's root directory.
    ```bash
    http-server -c-1
    ```
    The `-c-1` flag disables caching, which is useful for development. Open your browser and navigate to the redirect URI you configured (e.g., `http://localhost:8080`).

## API Contract

The frontend expects the following API endpoints to be available on the backend. Your backend should protect these endpoints and validate the user's identity using the token from Azure AD.

---

### `POST /api/generate-query`

Generates a MongoDB query using the Gemini API.

-   **Request Body:**
    ```json
    {
      "userInput": "A natural language prompt from the user.",
      "dbContext": { ...DbInfo } // Optional: context of the connected database
    }
    ```
-   **Success Response (200):**
    ```json
    {
      "intent_summary": "Summary of what the user wants to do.",
      "generated_code": "db.collection...",
      "confirmation_prompt": "A question to confirm the action."
    }
    ```

---

### `GET /api/databases`

Fetches the list of available database configurations.

-   **Success Response (200):**
    ```json
    [
      { "name": "Production-DB", "connectionString": "..." },
      { "name": "Staging-DB", "connectionString": "..." }
    ]
    ```

---

### `POST /api/connect`

Connects to a specific database and returns its metadata.

-   **Request Body:**
    ```json
    { "dbName": "Production-DB" }
    ```
-   **Success Response (200):**
    ```json
    {
      "name": "Production-DB",
      "collections": ["users", "products", "orders"],
      "totalDocuments": 125000,
      "size": "15.7 GB"
    }
    ```

---

### `GET /api/collections/:name/info`

Fetches detailed information for a specific collection, including a sample document. The sample document should use EJSON format for special types.

-   **Success Response (200):**
    ```json
    {
      "name": "users",
      "documentCount": 50000,
      "averageDocumentSize": "2.1 KB",
      "indexes": ["_id_", "email_1"],
      "sampleDocument": {
        "_id": { "$oid": "6c5babe1a3f5a5d5c5d5e1f3" },
        "lastLogin": { "$date": "2024-05-20T10:00:00Z" },
        "name": "John Doe"
      }
    }
    ```

---

### `POST /api/run-query`

Executes a MongoDB query string.

-   **Request Body:**
    ```json
    {
      "query": "db.collection('users').find({})",
      "dbName": "Production-DB"
    }
    ```
-   **Success Response (200):**
    An array of documents or a result object from the database driver.

---

## Disclaimer

This is a demonstration application. Do not use it with production databases or sensitive data without a thorough security review.
