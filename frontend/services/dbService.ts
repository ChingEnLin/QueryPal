import { DbInfo, DbConfig, CollectionInfo } from '../types';
import { USE_MSAL_AUTH } from '../app.config';
import { 
    mockDatabases, 
    mockECommerceDbInfo, 
    mockCollectionInfoMap, 
    mockUserFindResult,
    mockProductUpdateResult,
    mockGenericExecutionResult,
    mockDelay
} from './mockData';


const API_BASE_URL = '/api';

/**
 * Fetches available database configurations from the backend.
 * @returns A promise that resolves with an array of database configurations.
 */
export const getAvailableDatabases = async (): Promise<DbConfig[]> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log("DEV MODE: Returning mock databases.");
    await mockDelay(500);
    return Promise.resolve(mockDatabases);
  }
  // --- END DEVELOPMENT MOCK ---
  
  console.log("Fetching available databases from backend...");
  const response = await fetch(`${API_BASE_URL}/databases`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Could not load database list from server.' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Connects to a database via the backend and fetches its metadata.
 * @param dbName The name of the database to connect to.
 * @returns A promise that resolves with basic database information.
 */
export const connectToDatabase = async (dbName: string): Promise<DbInfo> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Returning mock DB info for ${dbName}.`);
    await mockDelay(800);
    if (dbName === 'Mock-ECommerce-DB') {
        return Promise.resolve(mockECommerceDbInfo);
    }
    // Return a generic/empty one for other DBs if needed
    const genericInfo: DbInfo = { name: dbName, collections: [], totalDocuments: 0, size: '0 MB' };
    return Promise.resolve(genericInfo);
  }
  // --- END DEVELOPMENT MOCK ---

  console.log(`Sending connection request for ${dbName} to backend...`);
  const response = await fetch(`${API_BASE_URL}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to connect to the database.' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data: DbInfo = await response.json();
  console.log(`Successfully connected to ${dbName}.`);
  return data;
};

/**
 * Fetches detailed information for a specific collection from the backend.
 * @param collectionName The name of the collection to fetch info for.
 * @returns A promise that resolves with detailed collection information.
 */
export const getCollectionInfo = async (collectionName: string): Promise<CollectionInfo> => {
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

    console.log(`Fetching info for collection: ${collectionName} from backend...`);
    const response = await fetch(`${API_BASE_URL}/collections/${collectionName}/info`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch collection details.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

/**
 * Sends a query to the backend to be executed against the database.
 * @param query The MongoDB query string to execute.
 * @param dbName The database context.
 * @returns A promise that resolves with the query result.
 */
export const runMongoQuery = async (query: string, dbName: string): Promise<any> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log(`DEV MODE: Returning mock execution result for query on ${dbName}.`);
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

    console.log(`Sending query for execution on ${dbName} to backend...`);
    const response = await fetch(`${API_BASE_URL}/run-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, dbName }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Invalid syntax in query or runtime error.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
};
