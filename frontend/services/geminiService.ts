
import { QueryResultData, DbInfo, CollectionInfo, DebuggingResult } from '../types';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { mockDelay, mockFindUsersQuery, mockUpdateProductsQuery, mockDefaultQuery, mockDebuggingResult } from './mockData';

/**
 * Sends the user's natural language prompt to the backend for processing by the Gemini API.
 * The backend is responsible for securely calling the AI model and returning the structured result.
 * @param userInput The natural language query from the user.
 * @param dbInfo Optional information about the connected database to provide context to the AI.
 * @param collectionContext Optional information about a specific collection to provide even more detailed context.
 * @param intermediateContext Optional data from a previous query result to be used as context.
 * @returns A promise that resolves with the structured query data.
 */
export const generateMongoQuery = async (
    userInput: string,
    dbInfo?: DbInfo,
    collectionContext?: CollectionInfo,
    intermediateContext?: any,
): Promise<QueryResultData> => {
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

    const response = await fetch(`${API_BASE_URL}/query/nl2query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_input: userInput,
            db_context: dbInfo, // Send DB context to the backend for more accurate queries
            collection_context: collectionContext, // Optional: send collection context if available
            intermediate_context: intermediateContext, // Optional: send data from a previous query
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || 'The AI model failed to generate a valid query.';
        throw new Error(errorMessage);
    }

    const result: QueryResultData = await response.json();
    return result;
};

/**
 * Sends a failed query and its error message to the backend for debugging with an AI model.
 * @param query The query code that failed.
 * @param errorMessage The error message from the database.
 * @returns A promise that resolves with the AI's debugging suggestion.
 */
export const debugMongoQuery = async (query: string, errorMessage: string): Promise<DebuggingResult> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Returning mock AI debugging result.");
        await mockDelay(2000); // Simulate AI thinking time
        return Promise.resolve(mockDebuggingResult);
    }
    // --- END DEVELOPMENT MOCK ---
    
    console.log("Sending failed query to backend for debugging...");

    const response = await fetch(`${API_BASE_URL}/query/debug`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            error_message: errorMessage,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || 'The AI model failed to provide a debugging suggestion.';
        throw new Error(errorMessage);
    }

    const result: DebuggingResult = await response.json();
    return result;
};