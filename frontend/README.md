
# QueryPal

QueryPal is an intelligent, AI-powered assistant that helps users perform MongoDB database operations using natural language. It generates executable MongoDB queries from plain English requests, provides a summary for verification, and allows direct execution against a connected database.

This application is powered by the **Google Gemini API** for its natural language processing capabilities.

## Features

- **Natural Language to MongoDB Query**: Convert commands like "find all active users from Canada" into executable MongoDB queries.
- **Database & Collection Explorer**: Connect to different databases and browse their collections.
- **Inferred Schema Viewer**: Click on a collection to view an automatically generated schema from a sample document, showing field names and data types (including `ObjectId`, `Date`, etc.).
- **Editable & Executable Queries**: Edit the AI-generated code directly in the browser and run it against the connected database.
- **Safe & Interactive Workflow**: The AI provides an intent summary and a confirmation prompt, ensuring you understand the operation before running it.
- **Responsive Design**: A clean, modern UI that works on various screen sizes.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI**: Google Gemini API
- **State Management**: React Context API
- **Module Loading**: ES Modules with `importmap`

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- A package manager like `npm` or `yarn`
- A local development server capable of serving static files. We recommend `http-server`.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd querypal
    ```

2.  **Install a simple server:**
    This project uses modern web features and does not require a complex build setup for development.
    ```bash
    npm install -g http-server
    ```

3.  **Backend Setup (Required for functionality):**
    This frontend application is designed to communicate with a backend server that handles database connections and secure calls to the Google Gemini API. You will need to create this backend.

    -   Create a `.env` file in your backend's root directory.
    -   Add your Google Gemini API key to the `.env` file:
        ```
        API_KEY=your_google_gemini_api_key
        ```
    -   Your backend should expose the API endpoints listed below.

4.  **Running the Frontend:**
    Start the local development server from the project's root directory.
    ```bash
    http-server -c-1
    ```
    The `-c-1` flag disables caching, which is useful for development. Open your browser and navigate to `http://localhost:8080`.

## API Contract

The frontend expects the following API endpoints to be available on the backend:

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
