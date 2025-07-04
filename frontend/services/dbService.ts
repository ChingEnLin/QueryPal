import { DbInfo, DbConfig, CollectionInfo } from '../types';

const API_BASE_URL = '/api';

/**
 * Fetches available database configurations from the backend.
 * @returns A promise that resolves with an array of database configurations.
 */
export const getAvailableDatabases = async (): Promise<DbConfig[]> => {
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
