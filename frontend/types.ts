
export interface QueryResultData {
  intent_summary: string;
  generated_code: string;
  confirmation_prompt: string;
}

export interface DbConfig {
  name: string;
  connectionString: string;
}

export interface DbInfo {
  name:string;
  collections: string[];
  totalDocuments: number;
  size: string;
}

export interface CollectionInfo {
    name: string;
    documentCount: number;
    averageDocumentSize: string;
    indexes: string[];
    sampleDocument: Record<string, any>;
}
