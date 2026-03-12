/**
 * Deletes a document from a collection.
 * @param collectionName The name of the collection.
 * @param resource The database account and name context.
 * @param documentId The document ID to delete.
 * @returns {Promise<boolean>} True if deleted, false otherwise.
 */
export async function deleteDocument(collectionName: string, resource: SelectedResource, documentId: string): Promise<boolean> {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    // Simulate delete always succeeds
    return Promise.resolve(true);
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();
  const response = await fetch(`${API_BASE_URL}/data/delete_document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      collection_name: collectionName,
      document_id: documentId,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete document.');
  }
  const result = await response.json();
  return !!result.success;
}
import { DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource, PaginatedDocumentsResponse, FoundDocumentResponse, DocumentHistoryResponse } from '../types';
import { msalInstance, loginRequest } from '../authConfig';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { getAuthErrorMessage, isAuthenticationExpiredError, isRecoverableAuthError } from '../utils/authErrorHandler';
import {
  mockCosmosAccounts,
  mockDatabasesByAccountId,
  mockCollectionInfoMap,
  mockUserFindResult,
  mockProductUpdateResult,
  mockGenericExecutionResult,
  mockDelay,
  mockCacheClearResult,
  mockDocCacheClearResult,
  mockUsersDocuments,
  mockProductsDocuments,
  mockOrdersCollectionInfo,
  mockUpdateDocument
} from './mockData';

/**
 * Helper function to get access token with proper error handling
 */
const getAuthenticatedToken = async (): Promise<string> => {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error("No signed-in user found.");
    }

    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });

    return response.accessToken;
  } catch (error) {
    if (isRecoverableAuthError(error) || isAuthenticationExpiredError(error)) {
      try {
        console.log('Silent token acquisition failed, attempting popup refresh...');
        const response = await msalInstance.acquireTokenPopup(loginRequest);
        return response.accessToken;
      } catch (popupError: any) {
        console.error('Popup token refresh also failed:', popupError);
        if (popupError?.errorCode === 'interaction_in_progress') {
          throw popupError;
        }
        throw new Error(getAuthErrorMessage(error));
      }
    }
    throw error;
  }
};

/**
 * Fetches available Azure Cosmos DB resources from the backend.
 * @returns A promise that resolves with an array of Cosmos DB resources.
 */
export const getAzureCosmosAccounts = async (): Promise<CosmosDBAccount[]> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log("DEV MODE: Returning mock Azure resources.");
    await mockDelay(1200);
    return Promise.resolve(mockCosmosAccounts);
  }
  // --- END DEVELOPMENT MOCK ---

  const accessToken = await getAuthenticatedToken();

  console.log("Fetching Azure cosmosdb accounts from backend...");
  const responseApi = await fetch(`${API_BASE_URL}/azure/cosmos_accounts`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!responseApi.ok) {
    if (responseApi.status === 401 || responseApi.status === 403) {
      throw new Error("Authentication failed or permission denied while fetching Azure accounts.");
    }
    const errorData = await responseApi.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Could not load Azure resource list from server. Status: ${responseApi.status}`;
    throw new Error(errorMessage);
  }

  return responseApi.json();
};


/**
 * Fetches the detailed information for all databases within a specific account.
 * @param accountId The resource ID of the account to fetch databases for.
 * @returns A promise that resolves with an array of detailed database information.
 */
export const getDatabasesForAccount = async (accountId: string): Promise<DbInfo[]> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Returning mock databases for account ID ${accountId}.`);
    await mockDelay(1000);

    // Simulate authorization failure for the special 'dev-empty-db'
    if (accountId.includes('dev-empty-db')) {
      return Promise.reject(new Error('Failed to fetch connection string: 403 {"error":{"code":"AuthorizationFailed"}}'));
    }

    const dbs = mockDatabasesByAccountId.get(accountId);
    if (dbs) {
      return Promise.resolve(dbs);
    }
    return Promise.reject(new Error(`Mock databases not found for account ID ${accountId}`));
  }
  // --- END DEVELOPMENT MOCK ---

  console.log(`Fetching databases for account ID ${accountId} from backend...`);

  // Use helper function to get authenticated token with proper error handling
  const accessToken = await getAuthenticatedToken();

  const response = await fetch(`${API_BASE_URL}/azure/account_details`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ account_id: accountId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Failed to fetch databases. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};


/**
 * Fetches detailed information for a specific collection from the backend.
 * @param collectionName The name of the collection to fetch info for.
 * @param resource The context of the database account and name.
 * @returns A promise that resolves with detailed collection information.
 */
export const getCollectionInfo = async (collectionName: string, resource: SelectedResource): Promise<CollectionInfo> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Returning mock collection info for ${collectionName}.`);
    await mockDelay(600);
    const info = mockCollectionInfoMap.get(collectionName);
    if (info) {
      return Promise.resolve(info);
    }
    return Promise.reject(new Error(`Mock collection info not found for ${collectionName}`));
  }
  // --- END DEVELOPMENT MOCK ---

  // Use helper function to get authenticated token with proper error handling
  const accessToken = await getAuthenticatedToken();

  console.log(`Fetching info for collection: ${collectionName} from backend...`);
  const response = await fetch(`${API_BASE_URL}/azure/collection_info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      collection_name: collectionName
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Failed to fetch collection details. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * Sends a query to the backend to be executed against the database.
 * @param query The MongoDB query string to execute.
 * @param resource The context of the database account and name.
 * @returns A promise that resolves with the query result.
 */
export const runMongoQuery = async (accountId: string, query: string, resource: SelectedResource): Promise<any> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Returning mock execution result for query on ${resource.databaseName}.`);
    await mockDelay(1000);
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('.find') && lowerQuery.includes('users')) {
      return Promise.resolve(mockUserFindResult);
    }
    if (lowerQuery.includes('.update_many') && lowerQuery.includes('products')) {
      return Promise.resolve(mockProductUpdateResult);
    }
    // Mock a failure for debugging demo
    if (lowerQuery.includes('sor')) {
      return Promise.reject(new Error('MongoDB query error: unknown operator: $sor (MongoServerError)'));
    }
    return Promise.resolve(mockGenericExecutionResult);
  }
  // --- END DEVELOPMENT MOCK ---
  console.log(`Fetching databases for account ID ${accountId} from backend...`);

  // Use helper function to get authenticated token with proper error handling
  const accessToken = await getAuthenticatedToken();

  console.log(`Sending query for execution on ${resource.databaseName} to backend...`);
  const response = await fetch(`${API_BASE_URL}/query/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      query: query,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Query execution failed. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * Sends a request to the backend to clear any server-side caches.
 */
export const clearSystemCache = async (): Promise<{ message: string }> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log("DEV MODE: Simulating system cache clear.");
    await mockDelay(800);
    return Promise.resolve(mockCacheClearResult);
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();

  const response = await fetch(`${API_BASE_URL}/system/clear_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Failed to clear server cache. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};


/**
 * Fetches documents from a specific collection with pagination and search.
 * @param collectionName The name of the collection.
 * @param resource The database account and name context.
 * @param page The page number to fetch.
 * @param limit The number of documents per page.
 * @param filter An optional object with key and value to filter documents by.
 * @returns A promise resolving to a paginated list of documents.
 */
export const getDocuments = async (
  collectionName: string,
  resource: SelectedResource,
  page: number,
  limit: number,
  filter?: { key: string, value: any, operator?: string },
  filters?: { key: string, value: any, operator?: string }[]
): Promise<PaginatedDocumentsResponse> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Fetching documents for ${collectionName}, page ${page}, filter:`, filter);
    await mockDelay(800);

    // Helper to access nested properties by a dot-notation string
    const getNestedValue = (obj: any, path: string): any => {
      return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : null, obj);
    };

    const sourceDocs = collectionName === 'users'
      ? mockUsersDocuments
      : collectionName === 'products'
        ? mockProductsDocuments
        : collectionName === 'orders'
          ? [mockOrdersCollectionInfo.sampleDocument]
          : [];

    const activeFilters: { key: string, value: any, operator?: string }[] = [];
    if (filter && ((filter.value !== null && filter.value !== undefined && filter.value !== '') || filter.operator === 'exists' || filter.operator === 'not_exists')) {
      activeFilters.push(filter);
    }
    if (filters) {
      for (const f of filters) {
        if (f && ((f.value !== null && f.value !== undefined && f.value !== '') || f.operator === 'exists' || f.operator === 'not_exists')) {
          activeFilters.push(f);
        }
      }
    }

    const filteredDocs = activeFilters.length > 0
      ? sourceDocs.filter(doc => {
        return activeFilters.every(f => {
          const searchVal = f.value;
          const docValue = getNestedValue(doc, f.key);

          if (f.operator === 'exists') {
            return docValue !== null && docValue !== undefined;
          } else if (f.operator === 'not_exists') {
            return docValue === null || docValue === undefined;
          }

          if (f.key === 'all') {
            const searchTerm = String(searchVal).toLowerCase();
            return JSON.stringify(doc).toLowerCase().includes(searchTerm);
          }

          if (docValue === null || docValue === undefined) return false;

          if (f.operator === 'not_equals') {
            return docValue !== searchVal;
          }
          if (f.operator === 'greater_than') {
            return docValue > searchVal;
          }
          if (f.operator === 'less_than') {
            return docValue < searchVal;
          }
          if (f.operator === 'contains') {
            return typeof docValue === 'string' && docValue.toLowerCase().includes(String(searchVal).toLowerCase());
          }

          if (typeof searchVal === 'string') {
            // "equals" still defaults to includes string matching when both are strings
            return String(docValue).toLowerCase().includes(searchVal.toLowerCase());
          }

          return docValue === searchVal;
        });
      })
      : sourceDocs;

    const totalDocuments = filteredDocs.length;
    const totalPages = Math.ceil(totalDocuments / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const documents = filteredDocs.slice(startIndex, endIndex);

    return Promise.resolve({
      documents,
      currentPage: page,
      totalPages,
      totalDocuments,
    });
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();

  const response = await fetch(`${API_BASE_URL}/data/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      collection_name: collectionName,
      page,
      limit,
      filter: filter && ((filter.value !== '' && filter.value !== null && filter.value !== undefined) || filter.operator === 'exists' || filter.operator === 'not_exists') ? filter : undefined,
      filters: filters && filters.length > 0 ? filters.filter(f => (f.value !== '' && f.value !== null && f.value !== undefined) || f.operator === 'exists' || f.operator === 'not_exists') : undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Failed to fetch documents. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * Finds a single document by its ID, searching across all provided collections.
 * @param documentId The string representation of the document's ObjectId.
 * @param resource The database account and name context.
 * @param collectionNames An array of collection names to search within.
 * @param keyContext An optional hint (the field name) for smarter searching on the backend.
 * @returns A promise that resolves with the found document and its collection name.
 */
export const findDocumentById = async (
  documentId: string,
  resource: SelectedResource,
  collectionNames: string[],
  keyContext?: string
): Promise<FoundDocumentResponse> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Finding document with ID ${documentId} (context: ${keyContext}) across collections.`);
    await mockDelay(700);

    // Prioritize search based on keyContext hint
    const lowerKeyContext = keyContext?.toLowerCase() ?? '';
    if (lowerKeyContext.includes('product') || lowerKeyContext.includes('item')) {
      const productDoc = mockProductsDocuments.find(doc => (doc._id?.$oid ?? doc._id) === documentId);
      if (productDoc) return Promise.resolve({ document: productDoc, collectionName: 'products' });
    }
    if (lowerKeyContext.includes('user') || lowerKeyContext.includes('patient')) {
      const userDoc = mockUsersDocuments.find(doc => (doc._id?.$oid ?? doc._id) === documentId);
      if (userDoc) return Promise.resolve({ document: userDoc, collectionName: 'users' });
    }

    // Fallback: search all mock collections if context hint fails
    const userDoc = mockUsersDocuments.find(doc => (doc._id?.$oid ?? doc._id) === documentId);
    if (userDoc) return Promise.resolve({ document: userDoc, collectionName: 'users' });

    const productDoc = mockProductsDocuments.find(doc => (doc._id?.$oid ?? doc._id) === documentId);
    if (productDoc) return Promise.resolve({ document: productDoc, collectionName: 'products' });

    if ((mockOrdersCollectionInfo.sampleDocument._id?.$oid ?? mockOrdersCollectionInfo.sampleDocument._id) === documentId) {
      return Promise.resolve({ document: mockOrdersCollectionInfo.sampleDocument, collectionName: 'orders' });
    }

    return Promise.reject(new Error(`Document with ID '${documentId}' not found in any mock collections.`));
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();

  const response = await fetch(`${API_BASE_URL}/data/find_by_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      collection_names: collectionNames,
      document_id: documentId,
      key_context: keyContext, // Pass the context hint to the backend
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Failed to find document. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * Clears the server-side cache for document lookups (`find_by_id`).
 * @returns A promise that resolves with a confirmation message.
 */
export const clearDocumentsCache = async (): Promise<{ message: string }> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log("DEV MODE: Simulating document cache clear.");
    await mockDelay(700);
    return Promise.resolve(mockDocCacheClearResult);
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();

  const response = await fetch(`${API_BASE_URL}/system/clear_documents_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || errorData.message || `Failed to clear document cache. Status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * Updates a document in the backend or mock data (DEV mode).
 * @param collection The name of the collection.
 * @param id The document ID.
 * @param content The updated document content.
 * @returns A promise resolving to the update result.
 */
export async function updateDocument(accountId: string, databaseName: string, collection: string, id: string, content: any) {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    return mockUpdateDocument(collection, id, content);
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();
  const response = await fetch(`${API_BASE_URL}/data/documents`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: accountId,
      database_name: databaseName,
      collection, id, content
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update document.');
  }
  return response.json();
}

/**
 * Fetches a single document by its ID from the backend.
 * @param accountId The resource ID of the account.
 * @param databaseName The name of the database.
 * @param collectionName The name of the collection.
 * @param documentId The ID of the document to fetch.
 * @returns A promise that resolves with the document data.
 */
export async function getSingleDocument(accountId: string, databaseName: string, collectionName: string, documentId: string) {
  const accessToken = await getAuthenticatedToken();
  const response = await fetch(`${API_BASE_URL}/data/document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: accountId,
      database_name: databaseName,
      collection_name: collectionName,
      document_id: documentId,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch document.');
  }
  return response.json();
}

/**
 * Inserts a new document into a collection.
 * @param collectionName The name of the collection.
 * @param resource The database account and name context.
 * @param doc The document to insert.
 * @returns The inserted document (with _id).
 */
export async function addDocument(collectionName: string, resource: SelectedResource, doc: Record<string, any>) {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    // Simulate _id assignment
    const newDoc = { ...doc, _id: { $oid: Math.random().toString(16).slice(2) } };
    return Promise.resolve(newDoc);
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();
  const response = await fetch(`${API_BASE_URL}/data/insert_document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      collection_name: collectionName,
      document: doc,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create document.');
  }
  return response.json();
}

/**
 * Gets the document history from the audit log.
 * @param resource The database account and name context.
 * @param collectionName The name of the collection.
 * @param documentId The document ID to get history for.
 * @returns The document history response with audit entries.
 */
export async function getDocumentHistory(resource: SelectedResource, collectionName: string, documentId: string): Promise<DocumentHistoryResponse> {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    // Mock data for development
    const mockHistoryData: DocumentHistoryResponse = {
      document_id: documentId,
      total_entries: 4,
      history_entries: [
        {
          id: '1',
          user_email: 'john.doe@example.com',
          operation: 'update',
          timestamp_utc: '2024-01-15T14:30:00Z',
          database_name: `${resource.accountId.split('/').pop()}.${resource.databaseName}`,
          collection_name: collectionName,
          diff_data: {
            status: { before: 'pending', after: 'active' },
            last_login: { before: null, after: '2024-01-15T14:29:45Z' },
            'profile.preferences.theme': { before: 'light', after: 'dark' }
          }
        },
        {
          id: '2',
          user_email: 'admin@system.com',
          operation: 'update',
          timestamp_utc: '2024-01-10T09:15:22Z',
          database_name: `${resource.accountId.split('/').pop()}.${resource.databaseName}`,
          collection_name: collectionName,
          diff_data: {
            email: { before: 'old.email@example.com', after: 'john.doe@example.com' },
            'profile.name': { before: 'John Smith', after: 'John Doe' }
          }
        },
        {
          id: '3',
          user_email: 'system@automated.com',
          operation: 'update',
          timestamp_utc: '2024-01-05T16:45:10Z',
          database_name: `${resource.accountId.split('/').pop()}.${resource.databaseName}`,
          collection_name: collectionName,
          diff_data: {
            'metadata.last_processed': { before: '2024-01-04T10:00:00Z', after: '2024-01-05T16:45:10Z' },
            'stats.login_count': { before: 42, after: 43 }
          }
        },
        {
          id: '4',
          user_email: 'jane.admin@example.com',
          operation: 'insert',
          timestamp_utc: '2024-01-01T12:00:00Z',
          database_name: `${resource.accountId.split('/').pop()}.${resource.databaseName}`,
          collection_name: collectionName,
          diff_data: {
            _id: documentId,
            email: 'old.email@example.com',
            status: 'pending',
            profile: {
              name: 'John Smith',
              preferences: { theme: 'light' }
            },
            created_at: '2024-01-01T12:00:00Z'
          }
        }
      ]
    };

    // Simulate API delay
    return new Promise(resolve => {
      setTimeout(() => resolve(mockHistoryData), 800);
    });
  }
  // --- END DEVELOPMENT MOCK ---
  const accessToken = await getAuthenticatedToken();

  const response = await fetch(`${API_BASE_URL}/data/document_history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      account_id: resource.accountId,
      database_name: resource.databaseName,
      collection_name: collectionName,
      document_id: documentId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to load document history.');
  }

  return response.json();
}