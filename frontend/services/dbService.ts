


import { DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource, PaginatedDocumentsResponse, FoundDocumentResponse } from '../types';
import { msalInstance, loginRequest } from '../authConfig';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
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
    mockOrdersCollectionInfo
} from './mockData';

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

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("No signed-in user found.");
  }

  // acquire token for backend API (must be set in loginRequest.scopes)
  const response = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account: accounts[0],
  });

  const accessToken = response.accessToken;
  
  console.log("Fetching Azure cosmosdb accounts from backend...");
  const responseApi = await fetch(`${API_BASE_URL}/azure/cosmos_accounts`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!responseApi.ok) {
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
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
      throw new Error("No signed-in user found.");
  }

  // acquire token for backend API (must be set in loginRequest.scopes)
  const tokenResponse = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
  });

  const accessToken = tokenResponse.accessToken;

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
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error("No signed-in user found.");
    }

    // acquire token for backend API (must be set in loginRequest.scopes)
    const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });

    const accessToken = tokenResponse.accessToken;

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
    const accounts = msalInstance.getAllAccounts();
    const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });

    const accessToken = tokenResponse.accessToken;
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
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error("No signed-in user found.");
    }

    // acquire token for backend API
    const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });

    const response = await fetch(`${API_BASE_URL}/system/clear_cache`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenResponse.accessToken}`,
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
    filter?: { key: string, value: any }
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
        
        const filteredDocs = (filter && filter.value !== null && filter.value !== undefined && filter.value !== '')
            ? sourceDocs.filter(doc => {
                const searchVal = filter.value;
                if (filter.key === 'all') {
                    // Global search: convert search value to string and do a substring search
                    const searchTerm = String(searchVal).toLowerCase();
                    return JSON.stringify(doc).toLowerCase().includes(searchTerm);
                }
                
                // Targeted field search
                const docValue = getNestedValue(doc, filter.key);

                if (docValue === null || docValue === undefined) return false;

                // if search value is a string, do case-insensitive contains.
                if (typeof searchVal === 'string') {
                    return String(docValue).toLowerCase().includes(searchVal.toLowerCase());
                }
                
                // for other types, do an exact match
                return docValue === searchVal;
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
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error("No signed-in user found.");
    }

    const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });
    const accessToken = tokenResponse.accessToken;

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
            filter: filter && (filter.value !== '' && filter.value !== null && filter.value !== undefined) ? filter : undefined,
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
    
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error("No signed-in user found.");
    }

    const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });
    const accessToken = tokenResponse.accessToken;

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
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error("No signed-in user found.");
    }

    const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });

    const response = await fetch(`${API_BASE_URL}/system/clear_documents_cache`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenResponse.accessToken}`,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || `Failed to clear document cache. Status: ${response.status}`;
        throw new Error(errorMessage);
    }
    
    return response.json();
};