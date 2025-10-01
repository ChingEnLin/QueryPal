import { SavedQuery } from '../types';
import { msalInstance, loginRequest } from '../authConfig';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { mockDelay, mockSavedQueries } from './mockData';
import { getAuthErrorMessage, isAuthenticationExpiredError, isRecoverableAuthError } from '../utils/authErrorHandler';

const getAccessToken = async (): Promise<string> => {
    try {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length === 0) {
            throw new Error("No signed-in user found.");
        }
        
        // Try silent token acquisition first
        const response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
        });
        return response.accessToken;
    } catch (error) {
        // If silent token acquisition fails, check if we can recover with interactive auth
        if (isRecoverableAuthError(error) || isAuthenticationExpiredError(error)) {
            try {
                console.log('Silent token acquisition failed, attempting popup refresh...');
                // Try popup for token refresh
                const response = await msalInstance.acquireTokenPopup(loginRequest);
                return response.accessToken;
            } catch (popupError) {
                console.error('Popup token refresh also failed:', popupError);
                // Only after both silent and popup fail, throw the user-friendly error
                throw new Error(getAuthErrorMessage(error));
            }
        }
        // Re-throw other errors as-is
        throw error;
    }
};

/**
 * Fetches the user's saved queries from the backend.
 * This includes queries they own and queries shared with them.
 */
export const getSavedQueries = async (): Promise<SavedQuery[]> => {
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Returning mock saved queries.");
        await mockDelay(800);
        // The mock data is already structured for sharing.
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
export const saveQuery = async (queryData: Pick<SavedQuery, 'name' | 'prompt' | 'code'>): Promise<SavedQuery> => {
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Mock saving query.", queryData);
        await mockDelay(500);
        const newQuery: SavedQuery = { 
            ...queryData, 
            id: `mock-id-${Date.now()}`,
            ownerEmail: 'dev.user@example.com', // In real app, backend gets this from token
            sharedWith: [],
            lastModifiedBy: 'dev.user@example.com',
            updatedAt: new Date().toISOString(),
        };
        mockSavedQueries.push(newQuery); // Add to mock array to simulate persistence for the session
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
 * This can be used to update content (name, prompt, code) or sharing settings.
 * @param query The full query object to update, including its ID.
 */
export const updateSavedQuery = async (query: SavedQuery): Promise<SavedQuery> => {
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Mock updating query.", query);
        await mockDelay(500);
        const updatedQuery = {
            ...query,
            lastModifiedBy: 'dev.user@example.com', // Assume current user is the editor
            updatedAt: new Date().toISOString(),
        };
        const index = mockSavedQueries.findIndex(q => q.id === query.id);
        if (index !== -1) {
            mockSavedQueries[index] = updatedQuery; // Update in-memory mock for session persistence
        }
        return Promise.resolve(updatedQuery);
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
        const index = mockSavedQueries.findIndex(q => q.id === queryId);
        if (index > -1) {
          mockSavedQueries.splice(index, 1);
        }
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
