import { SavedQuery } from '../types';
import { msalInstance, loginRequest } from '../authConfig';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { mockDelay, mockSavedQueries } from './mockData';

const getAccessToken = async (): Promise<string> => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error("No signed-in user found.");
    }
    const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
    });
    return response.accessToken;
};

/**
 * Fetches the user's saved queries from the backend.
 */
export const getSavedQueries = async (): Promise<SavedQuery[]> => {
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Returning mock saved queries.");
        await mockDelay(800);
        return Promise.resolve(mockSavedQueries);
    }

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/user/queries`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch saved queries.');
    }
    return response.json();
};

/**
 * Saves a new query to the backend.
 * @param queryData The data for the new query (name, prompt, code).
 */
export const saveQuery = async (queryData: Omit<SavedQuery, 'id'>): Promise<SavedQuery> => {
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Mock saving query.", queryData);
        await mockDelay(500);
        const newQuery: SavedQuery = { ...queryData, id: `mock-id-${Date.now()}` };
        // In a real scenario, you might update the mock data source here
        return Promise.resolve(newQuery);
    }
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/user/queries`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryData),
    });
    if (!response.ok) {
        throw new Error('Failed to save query.');
    }
    return response.json();
};

/**
 * Updates an existing saved query on the backend.
 * @param query The full query object to update, including its ID.
 */
export const updateSavedQuery = async (query: SavedQuery): Promise<SavedQuery> => {
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Mock updating query.", query);
        await mockDelay(500);
        return Promise.resolve(query);
    }
    
    const token = await getAccessToken();
    const { id, ...queryData } = query;
    const response = await fetch(`${API_BASE_URL}/user/queries/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryData),
    });
    if (!response.ok) {
        throw new Error('Failed to update saved query.');
    }
    return response.json();
};

/**
 * Deletes a saved query from the backend.
 * @param queryId The ID of the query to delete.
 */
export const deleteSavedQuery = async (queryId: string): Promise<void> => {
    if (!USE_MSAL_AUTH) {
        console.log(`DEV MODE: Mock deleting query with ID: ${queryId}`);
        await mockDelay(500);
        return Promise.resolve();
    }
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/user/queries/${queryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to delete saved query.');
    }
};