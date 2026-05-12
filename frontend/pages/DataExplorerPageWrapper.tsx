import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import DataExplorerPage from './DataExplorerPage';
import AppLayout from '../components/AppLayout';
import { SelectedResource, DbInfo, CosmosDBAccount } from '../types';
import { getAzureCosmosAccounts, getDatabasesForAccount } from '../services/dbService';

interface LocationState {
  dbInfo?: DbInfo;
  accountName?: string;
  availableDbs?: DbInfo[];
  availableAccounts?: CosmosDBAccount[];
}

const DataExplorerPageWrapper: React.FC = () => {
  const { accountId, databaseName, documentId } = useParams<{
    accountId: string;
    databaseName: string;
    documentId?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<{
    resource: SelectedResource;
    dbInfo: DbInfo;
    accountName: string;
    availableDbs: DbInfo[];
    availableAccounts: CosmosDBAccount[];
    initialDocumentId?: string;
  } | null>(null);

  useEffect(() => {
    const initializePageData = async () => {
      if (!accountId || !databaseName) {
        navigate('/query-generator');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Decode URL parameters
        const decodedAccountId = decodeURIComponent(accountId);
        const decodedDatabaseName = decodeURIComponent(databaseName);
        const decodedDocumentId = documentId ? decodeURIComponent(documentId) : undefined;

        console.log('DataExplorerPageWrapper - URL params:', {
          accountId: decodedAccountId,
          databaseName: decodedDatabaseName,
          documentId: decodedDocumentId
        });

        // Validate decoded parameters
        if (!decodedAccountId.trim() || !decodedDatabaseName.trim()) {
          throw new Error('Invalid account ID or database name');
        }

        const resource: SelectedResource = {
          accountId: decodedAccountId,
          databaseName: decodedDatabaseName
        };

        // If we have state from navigation, use it
        if (state?.dbInfo && state?.accountName && state?.availableDbs && state?.availableAccounts) {
          setPageData({
            resource,
            dbInfo: state.dbInfo,
            accountName: state.accountName,
            availableDbs: state.availableDbs,
            availableAccounts: state.availableAccounts,
            initialDocumentId: decodedDocumentId
          });
        } else {
          // Otherwise, fetch the data we need
          const [accounts, databases] = await Promise.all([
            getAzureCosmosAccounts(),
            getDatabasesForAccount(decodedAccountId)
          ]);

          const account = accounts.find(acc => acc.id === decodedAccountId);
          const database = databases.find(db => db.name === decodedDatabaseName);

          if (!account) {
            throw new Error(`Cosmos DB account '${decodedAccountId}' not found`);
          }

          if (!database) {
            throw new Error(`Database '${decodedDatabaseName}' not found in account '${account.name}'`);
          }

          setPageData({
            resource,
            dbInfo: database,
            accountName: account.name,
            availableDbs: databases,
            availableAccounts: accounts,
            initialDocumentId: decodedDocumentId
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data explorer');
        console.error('Error initializing data explorer:', err);
      } finally {
        setLoading(false);
      }
    };

    initializePageData();
  }, [accountId, databaseName, documentId, state, navigate]);

  const onNavigateBack = () => {
    navigate('/query-generator');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
        <div className="flex flex-col h-screen relative">
          
          {/* Loading Overlay */}
          <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl px-6 py-4 flex items-center gap-3 border border-slate-200 dark:border-slate-700">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-slate-700 dark:text-slate-200 font-medium">Loading database information...</span>
            </div>
          </div>
          
          {/* Skeleton Layout */}
          <header className="flex-shrink-0 bg-white dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-blue-500 rounded"></div>
                  <div>
                    <div className="w-32 h-6 bg-slate-300 dark:bg-slate-600 rounded animate-pulse"></div>
                    <div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-1"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  <div className="w-40 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-grow flex overflow-hidden">
            {/* Skeleton Collections Column */}
            <div className="w-1/4 xl:w-1/5 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
              <div className="p-4">
                <div className="w-24 h-6 bg-slate-300 dark:bg-slate-600 rounded animate-pulse mb-4"></div>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-full h-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Skeleton Documents Column */}
            <div className="w-1/4 xl:w-1/5 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-col">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="w-28 h-6 bg-slate-300 dark:bg-slate-600 rounded animate-pulse mb-2"></div>
                <div className="space-y-2">
                  <div className="w-full h-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  <div className="w-full h-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="flex-grow p-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-full h-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
                ))}
              </div>
            </div>

            {/* Skeleton Editor Column */}
            <div className="w-2/4 xl:w-3/5 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="w-20 h-6 bg-slate-300 dark:bg-slate-600 rounded animate-pulse"></div>
                <div className="w-full h-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#121212',
        color: 'white',
        gap: '20px'
      }}>
        <div>Error: {error}</div>
        <button 
          onClick={onNavigateBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Query Generator
        </button>
      </div>
    );
  }

  if (!pageData) {
    return null;
  }

  return (
    <AppLayout
      accountName={pageData.accountName}
      databaseName={pageData.dbInfo.name}
      collections={pageData.dbInfo.collections}
    >
      <DataExplorerPage
        resource={pageData.resource}
        dbInfo={pageData.dbInfo}
        accountName={pageData.accountName}
        availableDbs={pageData.availableDbs}
        availableAccounts={pageData.availableAccounts}
        initialDocumentId={pageData.initialDocumentId}
        onNavigateBack={onNavigateBack}
        embedded
      />
    </AppLayout>
  );
};

export default DataExplorerPageWrapper;
