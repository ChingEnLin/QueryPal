

/**
 * Represents a database connection configuration, primarily for display and selection.
 */
export interface DbConfig {
    name: string;
    connectionString: string;
}

export interface QueryResultData {
  intent_summary: string;
  generated_code: string;
  confirmation_prompt: string;
}

/**
 * Represents a database within a Cosmos DB account, used for selection.
 */
export interface DatabaseResource {
    name: string;
}

/**
 * Represents a discoverable Azure Cosmos DB account and its nested databases.
 */
export interface CosmosDBResource {
    id: string;
    name: string;
    databases: DatabaseResource[];
}

/**
 * A type representing the selected resource for API calls.
 */
export type SelectedResource = {
    accountName: string;
    databaseName: string;
};

/**
 * Represents the detailed information of a successfully connected database.
 */
export interface DbInfo {
  name:string;
  collections: string[];
  totalDocuments: number;
  size: string;
}

/**
 * Represents detailed information about a specific collection.
 */
export interface CollectionInfo {
    name: string;
    documentCount: number;
    averageDocumentSize: string;
    indexes: string[];
    sampleDocument: Record<string, any>;
}