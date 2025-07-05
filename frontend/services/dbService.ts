import { DbInfo, CollectionInfo, CosmosDBResource, SelectedResource } from '../types';
import { USE_MSAL_AUTH } from '../app.config';
import { 
    mockCosmosResources, 
    mockECommerceDbInfo, 
    mockCollectionInfoMap, 
    mockUserFindResult,
    mockProductUpdateResult,
    mockGenericExecutionResult,
    mockDelay
} from './mockData';


const API_BASE_URL = '/api';

/**
 * Fetches available Azure Cosmos DB resources from the backend.
 * @returns A promise that resolves with an array of Cosmos DB resources.
 */
export const getAzureCosmosResources = async (): Promise<CosmosDBResource[]> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log("DEV MODE: Returning mock Azure resources.");
    await mockDelay(1200);
    return Promise.resolve(mockCosmosResources);
  }
  // --- END DEVELOPMENT MOCK ---
  
  console.log("Fetching Azure resources from backend...");
  // In a real app, you would pass the MSAL access token here.
  const response = await fetch(`${API_BASE_URL}/azure/resources`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Could not load Azure resource list from server.' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Connects to a database via the backend and fetches its metadata.
 * @param resource The account and database to connect to.
 * @returns A promise that resolves with basic database information.
 */
export const connectToDatabase = async (resource: SelectedResource): Promise<DbInfo> => {
  // --- DEVELOPMENT MOCK ---
  if (!USE_MSAL_AUTH) {
    console.log(`DEV MODE: Returning mock DB info for ${resource.accountName}/${resource.databaseName}.`);
    await mockDelay(800);
    if (resource.databaseName === 'ECommerce-DB') {
        return Promise.resolve(mockECommerceDbInfo);
    }
    // Return a generic/empty one for other DBs if needed
    const genericInfo: DbInfo = { name: resource.databaseName, collections: ['items', 'logs'], totalDocuments: 100, size: '10 MB' };
    return Promise.resolve(genericInfo);
  }
  // --- END DEVELOPMENT MOCK ---

  console.log(`Sending connection request for ${resource.accountName}/${resource.databaseName} to backend...`);
  const response = await fetch(`${API_BASE_URL}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resource),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to connect to the database.' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data: DbInfo = await response.json();
  console.log(`Successfully connected to ${resource.databaseName}.`);
  return data;
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

    console.log(`Fetching info for collection: ${collectionName} from backend...`);
    const response = await fetch(`${API_BASE_URL}/collection-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resource, collectionName }),
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