import { QueryResultData, DbInfo } from '../types';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { mockDelay, mockFindUsersQuery, mockUpdateProductsQuery, mockDefaultQuery } from './mockData';

/**
 * Sends the user's natural language prompt to the backend for processing by the Gemini API.
 * The backend is responsible for securely calling the AI model and returning the structured result.
 * @param userInput The natural language query from the user.
 * @param dbInfo Optional information about the connected database to provide context to the AI.
 * @returns A promise that resolves with the structured query data.
 */
export const generateMongoQuery = async (userInput: string, dbInfo?: DbInfo): Promise<QueryResultData> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Returning mock AI-generated query.");
        await mockDelay(1500); // Simulate AI thinking time
        
        const lowerInput = userInput.toLowerCase();
        if (lowerInput.includes('user')) {
            return Promise.resolve(mockFindUsersQuery);
        }
        if (lowerInput.includes('price') || lowerInput.includes('product')) {
            return Promise.resolve(mockUpdateProductsQuery);
        }
        return Promise.resolve(mockDefaultQuery);
    }
    // --- END DEVELOPMENT MOCK ---
    
    console.log("Sending prompt to backend for query generation:", userInput);

    const response = await fetch(`${API_BASE_URL}/generate-query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userInput: userInput,
            dbContext: dbInfo, // Send DB context to the backend for more accurate queries
        }),
    });

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(errorData.message || 'The AI model failed to generate a valid query.');
        } catch (e) {
            // This catches JSON parsing errors or if the error response wasn't JSON.
             if (e instanceof Error) {
                throw new Error(e.message);
            }
            throw new Error('An unexpected error occurred while generating the query.');
        }
    }

    const result: QueryResultData = await response.json();
    return result;
};
