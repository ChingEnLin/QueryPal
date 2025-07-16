import { CosmosDBAccount, DbInfo, CollectionInfo, QueryResultData, DebuggingResult, AnalysisResult, SavedQuery } from '../types';

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
  collections: [
    { name: 'users', count: 5000 },
    { name: 'products', count: 10000 },
    { name: 'orders', count: 500 },
  ],
  totalDocuments: 15500,
  size: '256 MB',
};

const mockAnalyticsDbInfo: DbInfo = {
    name: 'Analytics-DB',
    collections: [
        { name: 'pageViews', count: 400000 },
        { name: 'userEvents', count: 100000 },
    ],
    totalDocuments: 500000,
    size: '1.2 GB'
};

const mockCmsContentDbInfo: DbInfo = {
    name: 'CMS-Content-DB',
    collections: [
        { name: 'articles', count: 1800 },
        { name: 'authors', count: 200 },
        { name: 'media', count: 500 },
    ],
    totalDocuments: 2500,
    size: null,
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
  generated_code: 'db[\'users\'].find({\n  "country": "Canada",\n  "status": "active"\n})',
};

export const mockUpdateProductsQuery: QueryResultData = {
    generated_code: 'db[\'products\'].update_many(\n  { "category": "Electronics" },\n  { "$mul": { "price": 1.1 } }\n)',
};

export const mockDefaultQuery: QueryResultData = {
    generated_code: 'db[\'your_collection\'].find({})',
};

// --- Mock AI Debugging ---
export const mockDebuggingResult: DebuggingResult = {
    suggestion: `It looks like there's a typo in your query.\n\nThe error message "pymongo.errors.OperationFailure: Message: {\\"Errors\\":[\\"Unknown operator: '$sor'\\"]}" suggests that the operator \`$sor\` is not recognized.\n\nThe correct operator for sorting in MongoDB is \`$sort\`.\n\n**Suggestion:**\nChange \`{ '$sor': { 'name': 1 } }\` to \`{ '$sort': { 'name': 1 } }\` in your query code.`
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

// --- Mock AI Analysis Result ---

export const mockAnalysisResult: AnalysisResult = {
  insight: "The query returned 3 active users from Canada. This indicates a small but active user base in this region. Visualizing the user count by country could provide broader insights if more data were available.",
  chartType: 'bar',
  chartData: {
    labels: ['Canada'],
    datasets: [{
      label: '# of Active Users',
      data: [3],
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  },
  chartOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            color: '#94a3b8' // text-slate-400
        }
      },
      title: {
        display: true,
        text: 'Active Users by Country',
        color: '#f1f5f9' // text-slate-100
      }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                color: '#94a3b8' // text-slate-400
            },
            grid: {
                color: 'rgba(148, 163, 184, 0.2)'
            }
        },
        x: {
            ticks: {
                color: '#94a3b8' // text-slate-400
            },
            grid: {
                color: 'rgba(148, 163, 184, 0.2)'
            }
        }
    }
  }
};


// --- Mock System Action Results ---
export const mockCacheClearResult = { message: 'Cache cleared successfully.' };

// --- Mock User Data (with Sharing) ---
const MOCK_USER_EMAIL = 'dev.user@example.com';
const OTHER_USER_EMAIL = 'colleague@example.com';

export const mockSavedQueries: SavedQuery[] = [
    {
        id: 'sq-1',
        name: 'My Private Query: Active Canadian Users',
        prompt: 'Find all users from Canada who are active',
        code: `db['users'].find({'country': 'Canada', 'status': 'active'})`,
        ownerEmail: MOCK_USER_EMAIL,
        sharedWith: [],
        lastModifiedBy: MOCK_USER_EMAIL,
        updatedAt: '2023-10-26T10:00:00Z',
    },
    {
        id: 'sq-2',
        name: 'My Shared Query: Increase Electronics Prices',
        prompt: 'Increase the price of all electronics by 10%',
        code: `db['products'].update_many({ "category": "Electronics" }, { "$mul": { "price": 1.1 } })`,
        ownerEmail: MOCK_USER_EMAIL,
        sharedWith: [OTHER_USER_EMAIL],
        lastModifiedBy: MOCK_USER_EMAIL,
        updatedAt: '2023-10-25T11:00:00Z',
    },
    {
        id: 'sq-3',
        name: 'Query Shared By Colleague: Recent Orders',
        prompt: 'Find all orders from the last 7 days',
        code: `db['orders'].find({ "orderDate": { "$gte": new Date(new Date().setDate(new Date().getDate() - 7)) } })`,
        ownerEmail: OTHER_USER_EMAIL,
        sharedWith: [MOCK_USER_EMAIL, 'another.person@example.com'],
        lastModifiedBy: OTHER_USER_EMAIL,
        updatedAt: '2023-10-24T12:00:00Z',
    },
     {
        id: 'sq-4',
        name: 'Untouchable Secret Query',
        prompt: 'This is a secret prompt',
        code: `db.doSecretThing()`,
        ownerEmail: 'boss@example.com',
        sharedWith: ['team.lead@example.com'],
        lastModifiedBy: 'boss@example.com',
        updatedAt: '2023-10-23T13:00:00Z',
    }
];
