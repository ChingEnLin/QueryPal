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

## Testing

This frontend includes comprehensive test suites to ensure code quality and reliability.

### Running Tests

#### Quick Start
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once and exit
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (if you have @vitest/ui installed)
npm run test:ui
```

### Test Structure

The test suites are organized as follows:

```
__tests__/
├── components/          # Component tests
│   └── Loader.test.tsx  # UI component tests
├── services/            # Service layer tests
│   ├── dbService.test.ts
│   ├── geminiService.test.ts
│   └── mockData.test.ts
├── utils/               # Utility function tests
│   └── schemaUtils.test.ts
└── App.test.tsx         # Main app component tests
```

### Test Coverage

The test suites currently cover:
- ✅ Core services (database, AI, mock data)
- ✅ Utility functions (schema processing)
- ✅ UI components (loader, basic components)
- ✅ App structure and routing logic
- ✅ Mock data validation
- ✅ Error handling scenarios

### Testing Tools

- **Vitest**: Fast unit test runner built for Vite
- **React Testing Library**: Simple and complete React DOM testing utilities
- **Jest DOM**: Custom Jest matchers for DOM elements
- **User Event**: Fire events the same way the user does

### Writing New Tests

When adding new components or services, ensure you:
1. Create corresponding test files in the `__tests__` directory
2. Follow the existing naming convention (`*.test.ts` or `*.test.tsx`)
3. Test both happy paths and error scenarios
4. Mock external dependencies appropriately
5. Maintain good test coverage for critical functionality

## API Contract

Your backend service must implement the following endpoints. All endpoints should be protected and require a valid Bearer token from the authenticated user.

---

### `GET /api/azure/cosmos_accounts`

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

### `POST /api/data/documents`

Fetches a paginated and searchable list of documents from a collection.

-   **Request Body:**
    ```json
    {
        "account_id": "/subscriptions/sub-id/resourceGroups/rg-prod/...",
        "database_name": "ECommerce-DB",
        "collection_name": "users",
        "page": 1,
        "limit": 20,
        "filter": {
            "key": "country",
            "value": "Canada"
        }
    }
    ```
    - `filter` is optional. If provided, the backend should perform a case-insensitive search.
    - `filter.key` can be `"all"` for a global search, or a specific field name (e.g., `"country"`, `"user.address.city"`).

-   **Success Response (200):** A paginated result object.
    ```json
    {
        "documents": [ { "_id": "...", "name": "John Doe", "country": "Canada", ... } ],
        "currentPage": 1,
        "totalPages": 5,
        "totalDocuments": 95
    }
    ```

---

### `PUT /api/data/documents`

Update a document in the specified collection by its ID. The request body should contain the updated document fields. Returns the updated document on success.

- **Method:** PUT
- **URL Params:**
  - `collection` (string): Name of the collection
  - `content` (object): The document content to update
  - `id` (string): Document ID
- **Body:** JSON object with updated fields (partial or full document)

#### Example
```
PUT /api/data/documents
{
  "name": "New Name",
  "email": "new@email.com"
}
```

- **Success Response (200):** The updated document object
- **Error Response (400/404):** Error message

---

### `POST /api/data/find_by_id`

Finds a single document by its `_id` by searching across a list of collections. The backend can use this list and the optional `key_context` to intelligently search for the referenced document.

-   **Request Body:**
    ```json
    {
        "account_id": "/subscriptions/sub-id/resourceGroups/rg-prod/...",
        "database_name": "ECommerce-DB",
        "collection_names": ["users", "products", "orders"],
        "document_id": "60d5ec49f5a8a1e9c8d5c8a1",
        "key_context": "userId"
    }
    ```
    - `key_context` (string, optional): The name of the field where the ID was found. The backend can use this as a hint (e.g., for a Gemini prompt) to determine which collection is most likely to contain the document.

-   **Success Response (200):** The found document and the name of the collection it was found in.
    ```json
    {
        "document": { "_id": { "$oid": "60d5ec49f5a8a1e9c8d5c8a1" }, "name": "John Doe", ... },
        "collectionName": "users"
    }
    ```
-   **Error Response (404):** If the document is not found.
    ```json
    {
        "detail": "Document with ID '60d5ec49f5a8a1e9c8d5c8a1' not found in any of the provided collections."
    }
    ```

---

### `POST /api/data/clear_documents_cache`

Clears the server-side cache used for the `find_by_id` endpoint. This is useful if linked data becomes stale.

-   **Request Body:** None.
-   **Success Response (200):** A confirmation message.
    ```json
    {
      "message": "Document lookup cache cleared successfully."
    }
    ```

---

### `POST /api/query/nl2query`

Generates a query using the Gemini API, providing database schema for context.

-   **Request Body:**
    ```json
    {
      "user_input": "A natural language prompt from the user.",
      "db_context": { "...DbInfo" },
      "collection_context": { "...CollectionInfo" },
      "intermediate_context": [
        { "...document1" },
        { "...document2" }
      ]
    }
    ```
    -   `user_input` (string, required): The user's natural language prompt.
    -   `db_context` (object, optional): Context of the connected database.
    -   `collection_context` (object, optional): Context of a specific collection.
    -   `intermediate_context` (array, optional): An array of values (e.g., documents, strings of IDs) from a previous query result to use as context for multi-step queries.

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
      "account_id": "/subscriptions/sub-id/resourceGroups/rg-prod/...",
      "database_name": "ECommerce-DB",
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

### `POST /api/query/analyze`

Sends a query result to the AI for analysis and visualization suggestions.

-   **Request Body:**
    ```json
    {
      "query_result": [ { "...document1" }, { "...document2" } ]
    }
    ```
-   **Success Response (200):** An object containing the AI's insight and a Chart.js compatible configuration.
    ```json
    {
      "insight": "A textual summary of the data.",
      "chartType": "bar",
      "chartData": { "...Chart.js data object" },
      "chartOptions": { "...Chart.js options object" }
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
### User Data API (Saved Queries)

---

### `GET /api/user/queries`

Retrieves all saved queries owned by or shared with the authenticated user. The backend should use the user's identity from the token to determine which queries to return.

-   **Success Response (200):** An array of `SavedQuery` objects.
    ```json
    [
        {
            "id": "query-123",
            "name": "Find Active Canadian Users",
            "prompt": "Find all users from Canada with an 'active' status",
            "code": "db['users'].find({'country': 'Canada', 'status': 'active'})",
            "ownerEmail": "user@example.com",
            "sharedWith": ["colleague1@example.com"],
            "lastModifiedBy": "user@example.com",
            "updatedAt": "2023-10-26T10:00:00Z"
        }
    ]
    ```

### `POST /api/user/queries`

Saves a new query for the user. The backend should generate a unique ID and set ownership fields.

-   **Request Body:**
    ```json
    {
        "name": "New Saved Query",
        "prompt": "The natural language prompt used.",
        "code": "The generated code to save."
    }
    ```
-   **Success Response (201):** The newly created `SavedQuery` object. The backend is responsible for setting `id`, `ownerEmail`, `sharedWith` (as `[]`), `lastModifiedBy`, and `updatedAt`.
    ```json
     {
        "id": "new-query-456",
        "name": "New Saved Query",
        "prompt": "The natural language prompt used.",
        "code": "The generated code to save.",
        "ownerEmail": "creator@example.com",
        "sharedWith": [],
        "lastModifiedBy": "creator@example.com",
        "updatedAt": "2023-10-27T10:00:00Z"
    }
    ```

### `PUT /api/user/queries/{queryId}`

Updates an existing saved query. Can be used to update the query content (`name`, `prompt`, `code`) or its sharing settings (`sharedWith`). The backend must verify that the authenticated user is either the owner or has been shared the query.

-   **Request Body:** The full `SavedQuery` object with modifications.
    ```json
    {
        "id": "query-123",
        "name": "Updated Query Name",
        "prompt": "Updated prompt text.",
        "code": "Updated query code.",
        "ownerEmail": "user@example.com",
        "sharedWith": ["colleague1@example.com", "colleague2@example.com"],
        "lastModifiedBy": "user@example.com",
        "updatedAt": "2023-10-26T10:00:00Z"
    }
    ```
-   **Success Response (200):** The updated `SavedQuery` object, with `lastModifiedBy` and `updatedAt` updated by the backend.

### `DELETE /api/user/queries/{queryId}`

Deletes a saved query. The backend must verify that the authenticated user is the owner of the query.

-   **Success Response (204):** No content.

---

## Disclaimer

This is a demonstration application. Do not use it with production databases or sensitive data without a thorough security review of both the frontend and your backend implementation.