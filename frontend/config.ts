import type { DbConfig } from './types';

/**
 * Add your MongoDB connection configurations here.
 * The connection strings are for display/labeling purposes in this demo app.
 * In a real application, these would be used by a secure backend service to connect to the database.
 */
export const databaseConnections: DbConfig[] = [
  {
    name: 'Production-DB',
    connectionString: 'mongodb+srv://user:****@prod.mongodb.net/main_db',
  },
  {
    name: 'Staging-DB',
    connectionString: 'mongodb+srv://user:****@staging.mongodb.net/test_db',
  },
  {
    name: 'Development-DB',
    connectionString: 'mongodb://v-patients-saas-development2:PxzKGO1LYkUTRcviQJnUFdv3dxhibkEsalaXkRxSnpMvhsPA0pj5H36u4nuAvm9YEoAR61jYLFvcEj6cCqTHrA==@v-patients-saas-development2.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@v-patients-saas-development2@',
  },
];

// Re-export DbConfig because it's used in the type of the exported `databaseConnections` constant.
export type { DbConfig };
