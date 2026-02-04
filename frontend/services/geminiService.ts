import { QueryResultData, DbInfo, CollectionInfo, DebuggingResult, AnalysisResult, SchemaRelationshipsResponse } from '../types';
import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { mockDelay, mockFindUsersQuery, mockUpdateProductsQuery, mockDefaultQuery, mockDebuggingResult, mockAnalysisResult } from './mockData';
import { msalInstance, loginRequest } from '../authConfig';
import { getAuthErrorMessage, isAuthenticationExpiredError } from '../utils/authErrorHandler';

/**
 * Sends the user's natural language prompt to the backend for processing by the Gemini API.
 * The backend is responsible for securely calling the AI model and returning the structured result.
 * @param userInput The natural language query from the user.
 * @param accountId The Azure Cosmos DB account ID to fetch schema context for.
 * @param dbInfo Optional information about the connected database to provide context to the AI.
 * @param collectionContext Optional information about a specific collection to provide even more detailed context.
 * @param intermediateContext Optional data from a previous query result to be used as context.
 * @returns A promise that resolves with the structured query data.
 */
export const generateMongoQuery = async (
    userInput: string,
    accountId: string,
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

    // Acquire Token
    let accessToken = "";
    try {
        const account = msalInstance.getAllAccounts()[0]; // Assume first account
        if (!account) {
            throw new Error("No active account found. Please sign in.");
        }
        const response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: account
        });
        accessToken = response.accessToken;
    } catch (error) {
        console.error("Failed to acquire token silently:", getAuthErrorMessage(error));
        throw new Error("Authentication failed. Please refresh the page and sign in again.");
    }

    const response = await fetch(`${API_BASE_URL}/query/nl2query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            user_input: userInput,
            account_id: accountId,
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

/**
 * Sends a query result to the backend to be analyzed by an AI model.
 * The AI will return insights and a suggested visualization.
 * @param queryResult The data returned from a successful query execution.
 * @returns A promise that resolves with the AI's analysis.
 */
export const analyzeQueryResult = async (queryResult: any): Promise<AnalysisResult> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Returning mock AI analysis result.");
        await mockDelay(2500); // Simulate AI thinking time
        // This mock assumes the input is the user find result
        if (Array.isArray(queryResult) && queryResult[0]?.country === 'Canada') {
            return Promise.resolve(mockAnalysisResult);
        }
        // Generic fallback for other data
        throw new Error("No mock analysis available for this data. Please implement a new mock in services/mockData.ts");
    }
    // --- END DEVELOPMENT MOCK ---

    console.log("Sending query result to backend for analysis...");

    const response = await fetch(`${API_BASE_URL}/query/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query_result: queryResult }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || 'The AI model failed to provide an analysis.';
        throw new Error(errorMessage);
    }

    const result: AnalysisResult = await response.json();
    return result;
};


/**
 * Infers relationships between selected collections using AI.
 * @param accountId The Azure Cosmos DB account ID.
 * @param databaseName The name of the database.
 * @param collectionNames The list of collections to analyze.
 * @returns A promise that resolves with the inferred relationships.
 */
export const inferSchemaRelationships = async (
    accountId: string,
    databaseName: string,
    collectionNames: string[]
): Promise<SchemaRelationshipsResponse> => {
    // --- DEVELOPMENT MOCK ---
    if (!USE_MSAL_AUTH) {
        console.log("DEV MODE: Returning mock AI relationship inference.");
        await mockDelay(2000);
        return Promise.resolve({
            relationships: [
                {
                    source_collection: collectionNames[0] || "orders",
                    source_field: "userId",
                    target_collection: collectionNames[1] || "users",
                    target_field: "_id",
                    description: "Inferred foreign key relationship based on field name similarity.",
                    confidence: 0.95
                }
            ]
        });
    }
    // --- END DEVELOPMENT MOCK ---

    console.log("Sending schema inference request to backend...");

    // Acquire Token
    let accessToken = "";
    try {
        const account = msalInstance.getAllAccounts()[0];
        if (!account) {
            throw new Error("No active account found. Please sign in.");
        }
        const response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: account
        });
        accessToken = response.accessToken;
    } catch (error) {
        console.error("Failed to acquire token silently:", getAuthErrorMessage(error));
        throw new Error("Authentication failed. Please refresh the page and sign in again.");
    }

    const response = await fetch(`${API_BASE_URL}/query/infer-relationships`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            account_id: accountId,
            database_name: databaseName,
            collection_names: collectionNames
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || 'The AI model failed to infer relationships.';
        throw new Error(errorMessage);
    }

    const result: SchemaRelationshipsResponse = await response.json();
    return result;
};