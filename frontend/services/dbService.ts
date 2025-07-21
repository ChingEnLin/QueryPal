

import { DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource, PaginatedDocumentsResponse } from '../types';
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
    mockUsersDocuments
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
 * @param searchTerm An optional term to filter documents by.
 * @returns A promise resolving to a paginated list of documents.
 */
export const getDocuments = async (
    collectionName: string, 
    resource: SelectedResource, 
    page: number, 
    limit: number, 
    searchTerm?: string
): Promise<PaginatedDocumentsResponse> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log(`DEV MODE: Fetching documents for ${collectionName}, page ${page}, search: "${searchTerm}"`);
        await mockDelay(800);
        
        // To make the mock functional for any collection, we'll use the users documents as a sample for all.
        const sourceDocs = mockUsersDocuments;
        
        const filteredDocs = searchTerm
            ? sourceDocs.filter(doc => 
                JSON.stringify(doc).toLowerCase().includes(searchTerm.toLowerCase())
            )
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
            search_term: searchTerm,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || `Failed to fetch documents. Status: ${response.status}`;
        throw new Error(errorMessage);
    }

    return response.json();
};