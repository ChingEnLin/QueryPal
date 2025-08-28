import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import DataExplorerPage from './DataExplorerPage';
import { SelectedResource, DbInfo, CosmosDBAccount } from '../types';
import { getAzureCosmosAccounts, getDatabasesForAccount } from '../services/dbService';
import Loader from '../components/Loader';

interface LocationState {
  dbInfo?: DbInfo;
  accountName?: string;
  availableDbs?: DbInfo[];
  availableAccounts?: CosmosDBAccount[];
}

const DataExplorerPageWrapper: React.FC = () => {
  const { accountId, databaseName } = useParams<{ accountId: string; databaseName: string }>();
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
            availableAccounts: state.availableAccounts
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
            availableAccounts: accounts
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
  }, [accountId, databaseName, state, navigate]);

  const onNavigateBack = () => {
    navigate('/query-generator');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#121212',
        color: 'white'
      }}>
        <Loader />
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
    <DataExplorerPage
      initialResource={pageData.resource}
      initialDbInfo={pageData.dbInfo}
      accountName={pageData.accountName}
      availableDbs={pageData.availableDbs}
      availableAccounts={pageData.availableAccounts}
      onNavigateBack={onNavigateBack}
    />
  );
};

export default DataExplorerPageWrapper;
