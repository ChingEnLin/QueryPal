import { DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource } from '../types';
import { msalInstance, loginRequest } from '@/authConfig';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { 
    mockCosmosAccounts, 
    mockDatabasesByAccountId, 
    mockCollectionInfoMap, 
    mockUserFindResult,
    mockProductUpdateResult,
    mockGenericExecutionResult,
    mockDelay,
    mockCacheClearResult
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
    const errorData = await responseApi.json().catch(() => ({ message: 'Could not load Azure resource list from server.' }));
    throw new Error(errorData.message || `HTTP error! status: ${responseApi.status}`);
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
      const errorData = await response.json().catch(() => ({ message: `Failed to fetch databases for account ID ${accountId}.` }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch collection details.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

/**
 * Sends a query to the backend to be executed against the database.
 * @param query The MongoDB query string to execute.
 * @param resource The context of the database account and name.
 * @returns A promise that resolves with the query result.
 */
export const runMongoQuery = async (query: string, resource: SelectedResource): Promise<any> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log(`DEV MODE: Returning mock execution result for query on ${resource.databaseName}.`);
        await mockDelay(1000);
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('.find') && lowerQuery.includes('users')) {
            return Promise.resolve(mockUserFindResult);
        }
        if (lowerQuery.includes('.updatemany') && lowerQuery.includes('products')) {
            return Promise.resolve(mockProductUpdateResult);
        }
        return Promise.resolve(mockGenericExecutionResult);
    }
    // --- END DEVELOPMENT MOCK ---

    console.log(`Sending query for execution on ${resource.databaseName} to backend...`);
    const response = await fetch(`${API_BASE_URL}/run-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...resource }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Invalid syntax in query or runtime error.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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

    const response = await fetch(`${API_BASE_URL}/system/clear-cache`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenResponse.accessToken}`,
        },
    });

     if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to clear server cache.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
};