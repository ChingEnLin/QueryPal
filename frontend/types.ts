

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
 * Represents the result from the AI debugging service.
 */
export interface DebuggingResult {
    suggestion: string;
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

// --- Types for AI Analysis and Graphing ---

export type ChartJSType = 'bar' | 'line' | 'pie' | 'doughnut' | 'polarArea' | 'radar' | 'scatter' | 'bubble';

export interface ChartJSDataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    // Allow other chart.js dataset properties
    [key: string]: any; 
}

export interface ChartJSData {
    labels: string[];
    datasets: ChartJSDataset[];
}

// Using `any` for options is pragmatic as they are very complex
export type ChartJSOptions = any;

/**
 * Represents the result from the AI analysis service.
 */
export interface AnalysisResult {
    insight: string;
    chartType: ChartJSType;
    chartData: ChartJSData;
    chartOptions?: ChartJSOptions;
}

/**
 * Represents a single step in the user's query workflow for notebook generation.
 */
export interface NotebookStep {
  id: string;
  type: 'query' | 'note'; // Add type to distinguish steps
  prompt: string; // For query: NL prompt. For note: markdown content.
  query?: string; // Query code is optional now (for notes)
  resultSample?: any; // Result sample is optional (for notes)
  contextSource?: string;
  isEditing?: boolean; // Transient state for UI editing of notes
}

/**
 * Represents a query saved by the user for later use, now with sharing capabilities.
 */
export interface SavedQuery {
    id: string;
    name: string;
    prompt: string;
    code: string;
    // New fields for sharing and collaboration
    ownerEmail: string;
    sharedWith: string[];
    lastModifiedBy: string;
    updatedAt: string; // ISO 8601 timestamp
}

/**
 * Represents the response structure for a paginated list of documents.
 */
export interface PaginatedDocumentsResponse {
    documents: Record<string, any>[];
    currentPage: number;
    totalPages: number;
    totalDocuments: number;
}