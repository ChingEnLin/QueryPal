import { CosmosDBAccount, DbInfo, CollectionInfo, QueryResultData } from '../types';

// --- Helper to simulate network latency ---
export const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// --- Mock Azure and Database Data ---

export const mockCosmosAccounts: CosmosDBAccount[] = [
  { 
    id: '/subscriptions/mock-sub/resourceGroups/rg-prod/providers/Microsoft.DocumentDB/databaseAccounts/prod-ecommerce-db',
    name: 'prod-ecommerce-db', 
  },
  { 
    id: '/subscriptions/mock-sub/resourceGroups/rg-staging/providers/Microsoft.DocumentDB/databaseAccounts/staging-cms-db',
    name: 'staging-cms-db', 
  },
  {
    id: '/subscriptions/mock-sub/resourceGroups/rg-dev/providers/Microsoft.DocumentDB/databaseAccounts/dev-empty-db',
    name: 'dev-empty-db',
  }
];

export const mockECommerceDbInfo: DbInfo = {
  name: 'ECommerce-DB',
  collections: ['users', 'products', 'orders'],
  totalDocuments: 15500,
  size: '256 MB',
};

const mockAnalyticsDbInfo: DbInfo = {
    name: 'Analytics-DB',
    collections: ['pageViews', 'userEvents'],
    totalDocuments: 500000,
    size: '1.2 GB'
};

const mockCmsContentDbInfo: DbInfo = {
    name: 'CMS-Content-DB',
    collections: ['articles', 'authors', 'media'],
    totalDocuments: 2500,
    size: '80 MB'
};

export const mockDatabasesByAccountId: Map<string, DbInfo[]> = new Map([
    ['/subscriptions/mock-sub/resourceGroups/rg-prod/providers/Microsoft.DocumentDB/databaseAccounts/prod-ecommerce-db', [mockECommerceDbInfo, mockAnalyticsDbInfo]],
    ['/subscriptions/mock-sub/resourceGroups/rg-staging/providers/Microsoft.DocumentDB/databaseAccounts/staging-cms-db', [mockCmsContentDbInfo]],
    ['/subscriptions/mock-sub/resourceGroups/rg-dev/providers/Microsoft.DocumentDB/databaseAccounts/dev-empty-db', []]
]);


const mockUsersCollectionInfo: CollectionInfo = {
  name: 'users',
  documentCount: 5000,
  averageDocumentSize: '1.2 KB',
  indexes: ['_id_', 'email_1', 'country_1', 'status_1'],
  sampleDocument: {
    _id: { $oid: '60d5ec49f5a8a1e9c8d5c8a1' },
    name: 'John Doe',
    email: 'john.doe@example.com',
    country: 'Canada',
    status: 'active',
    lastLogin: { $date: '2023-10-26T10:00:00Z' },
  },
};

const mockProductsCollectionInfo: CollectionInfo = {
    name: 'products',
    documentCount: 10000,
    averageDocumentSize: '2.5 KB',
    indexes: ['_id_', 'sku_1', 'category_1'],
    sampleDocument: {
        _id: { $oid: '60d5ec49f5a8a1e9c8d5c8a2'},
        name: 'Wireless Mouse',
        sku: 'WM-101',
        price: 25.99,
        category: 'Electronics',
        stock: 150,
    },
};

const mockOrdersCollectionInfo: CollectionInfo = {
    name: 'orders',
    documentCount: 500,
    averageDocumentSize: '3.1 KB',
    indexes: ['_id_', 'userId_1', 'orderDate_1'],
    sampleDocument: {
        _id: { $oid: '60d5ec49f5a8a1e9c8d5c8a3'},
        userId: { $oid: '60d5ec49f5a8a1e9c8d5c8a1' },
        orderDate: { $date: '2023-10-25T14:30:00Z' },
        total: 75.50,
        items: [
            { productId: { $oid: '60d5ec49f5a8a1e9c8d5c8a2' }, quantity: 2},
        ]
    }
};

export const mockCollectionInfoMap: Map<string, CollectionInfo> = new Map([
    ['users', mockUsersCollectionInfo],
    ['products', mockProductsCollectionInfo],
    ['orders', mockOrdersCollectionInfo]
]);


// --- Mock AI-Generated Queries ---

export const mockFindUsersQuery: QueryResultData = {
  intent_summary: 'The user wants to find all active users from Canada.',
  generated_code: 'db.collection(\'users\').find({\n  country: "Canada",\n  status: "active"\n})',
  confirmation_prompt: 'This will find all documents in the \'users\' collection where the country is Canada and the status is active. Do you want to proceed?',
};

export const mockUpdateProductsQuery: QueryResultData = {
    intent_summary: 'The user wants to increase the price of all electronic products by 10%.',
    generated_code: 'db.collection(\'products\').updateMany(\n  { category: "Electronics" },\n  { $mul: { price: 1.1 } }\n)',
    confirmation_prompt: 'This will update multiple documents in the \'products\' collection, increasing the price for all items in the "Electronics" category by 10%. This is a potentially destructive operation. Do you want to proceed?',
};

export const mockDefaultQuery: QueryResultData = {
    intent_summary: 'The user has made a request that could not be mapped to a specific mock.',
    generated_code: 'db.collection(\'your_collection\').find({})',
    confirmation_prompt: 'The AI has generated a query based on your request. Please review it carefully before execution.'
};


// --- Mock Query Execution Results ---

export const mockUserFindResult = [
  { _id: 'user1', name: 'Alice', email: 'alice@example.com', country: 'Canada', status: 'active' },
  { _id: 'user2', name: 'Bob', email: 'bob@example.com', country: 'Canada', status: 'active' },
  { _id: 'user3', name: 'Charlie', email: 'charlie@example.com', country: 'Canada', status: 'active' },
];

export const mockProductUpdateResult = {
  acknowledged: true,
  modifiedCount: 350,
  upsertedId: null,
  upsertedCount: 0,
  matchedCount: 350,
};

export const mockGenericExecutionResult = { message: 'Query executed successfully (mocked).' };