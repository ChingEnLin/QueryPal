

/**
 * Represents a summarized view of a collection within a database.
 */
export interface CollectionSummary {
    name: string;
    count: number;
}

/**
 * Represents a database connection configuration, primarily for display and selection.
 */
export interface DbConfig {
    name: string;
    connectionString: string;
}

export interface QueryResultData {
  generated_code: string;
}

/**
 * Represents a discoverable Azure Cosmos DB account.
 */
export interface CosmosDBAccount {
    id: string;
    name: string;
}

/**
 * A type representing the selected resource for API calls.
 */
export type SelectedResource = {
    accountId: string;
    databaseName: string;
};

/**
 * Represents the detailed information of a successfully connected database.
 */
export interface DbInfo {
  name:string;
  collections: CollectionSummary[];
  totalDocuments: number;
  size: string | null;
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