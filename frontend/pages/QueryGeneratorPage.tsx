import React, { useState, useCallback, useEffect } from 'react';
import { generateMongoQuery } from '../services/geminiService';
import { getAvailableDatabases, connectToDatabase, runMongoQuery, getCollectionInfo } from '../services/dbService';
import { QueryResultData, DbInfo, DbConfig, CollectionInfo } from '../types';
import QueryDisplay from '../components/QueryDisplay';
import QueryResult from '../components/QueryResult';
import Loader from '../components/Loader';
import MongoIcon from '../components/icons/MongoIcon';
import DatabaseIcon from '../components/icons/DatabaseIcon';
import ServerIcon from '../components/icons/ServerIcon';
import CollectionActionPanel from '../components/CollectionActionPanel';
import { useAuth } from '../contexts/AuthContext';

const QueryGeneratorPage: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for DB connection
  const [availableDbs, setAvailableDbs] = useState<DbConfig[]>([]);
  const [isLoadingDbs, setIsLoadingDbs] = useState<boolean>(true);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectedDbInfo, setConnectedDbInfo] = useState<DbInfo | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // State for AI query generation
  const [queryResult, setQueryResult] = useState<QueryResultData | null>(null);
  const [editableCode, setEditableCode] = useState<string>('');

  // State for query execution
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // State for collection details
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(null);
  const [isFetchingCollectionInfo, setIsFetchingCollectionInfo] = useState<boolean>(false);
  const [collectionInfoError, setCollectionInfoError] = useState<string | null>(null);


  const { logout } = useAuth();

  useEffect(() => {
    const fetchDbs = async () => {
      setIsLoadingDbs(true);
      try {
        const dbs = await getAvailableDatabases();
        setAvailableDbs(dbs);
        if (dbs.length > 0) {
          setSelectedDb(dbs[0].name);
        }
      } catch (e) {
        setDbError("Could not load database list from server.");
      } finally {
        setIsLoadingDbs(false);
      }
    };
    fetchDbs();
  }, []);

  const clearQueryState = useCallback(() => {
    setQueryResult(null);
    setError(null);
    setEditableCode('');
    setExecutionResult(null);
    setExecutionError(null);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!selectedDb) return;
    setIsConnecting(true);
    setDbError(null);
    try {
      const info = await connectToDatabase(selectedDb);
      setConnectedDbInfo(info);
      clearQueryState();
    } catch (e) {
      if (e instanceof Error) setDbError(e.message);
      else setDbError("An unknown error occurred during connection.");
    } finally {
      setIsConnecting(false);
    }
  }, [selectedDb, clearQueryState]);

  const handleDisconnect = useCallback(() => {
    setConnectedDbInfo(null);
    clearQueryState();
    setUserInput('');
    setSelectedCollection(null);
    setCollectionInfo(null);
  }, [clearQueryState]);

  const handleGenerateQuery = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setError("Please enter a command in plain English.");
      return;
    }

    setIsLoading(true);
    clearQueryState();

    try {
      const result = await generateMongoQuery(prompt, connectedDbInfo ?? undefined);
      setQueryResult(result);
      setEditableCode(result.generated_code);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [connectedDbInfo, clearQueryState]);

  const handleMainGenerateClick = () => handleGenerateQuery(userInput);
  
  const handleGenerateCollectionQuery = (collectionPrompt: string) => {
    if (!selectedCollection) return;
    const fullPrompt = `For the '${selectedCollection}' collection, ${collectionPrompt}`;
    setUserInput(fullPrompt); // Optional: update main input as well
    handleGenerateQuery(fullPrompt);
  };

  const handleRunQuery = useCallback(async () => {
    if (!editableCode.trim() || !connectedDbInfo) {
      setExecutionError("Cannot run an empty query or without a database connection.");
      return;
    }
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);

    try {
      const result = await runMongoQuery(editableCode, connectedDbInfo.name);
      setExecutionResult(result);
    } catch (e) {
      if (e instanceof Error) setExecutionError(e.message);
      else setExecutionError("An unknown error occurred while running the query.");
    } finally {
      setIsExecuting(false);
    }
  }, [editableCode, connectedDbInfo]);

  const handleCollectionClick = useCallback(async (collectionName: string) => {
    if (selectedCollection === collectionName) {
        // Toggle off if clicking the same collection
        setSelectedCollection(null);
        setCollectionInfo(null);
        return;
    }
    setSelectedCollection(collectionName);
    setIsFetchingCollectionInfo(true);
    setCollectionInfoError(null);
    setCollectionInfo(null);
    try {
        const info = await getCollectionInfo(collectionName);
        setCollectionInfo(info);
    } catch (e) {
        if (e instanceof Error) setCollectionInfoError(e.message);
        else setCollectionInfoError("Failed to fetch collection details.");
    } finally {
        setIsFetchingCollectionInfo(false);
    }
  }, [selectedCollection]);

  const isQuerySectionDisabled = !connectedDbInfo;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        <header className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
                <MongoIcon className="w-12 h-12 text-blue-500" />
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">QueryPal</h1>
                    <p className="text-slate-500 text-sm sm:text-base">Your AI-powered database assistant.</p>
                </div>
            </div>
            <button
                onClick={logout}
                className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
            >
                Sign Out
            </button>
        </header>

        <main className="space-y-8">
          {/* Connection Manager */}
          <div className="bg-white rounded-xl shadow-md p-6">
            {connectedDbInfo ? (
              <div className="animate-fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Database Information</h2>
                    <p className="text-blue-600 font-mono text-sm">Connected to: {connectedDbInfo.name}</p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-100 p-3 rounded-lg">
                    <p className="text-slate-500">Total Documents</p>
                    <p className="text-slate-900 font-semibold text-lg">{connectedDbInfo.totalDocuments.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-lg">
                    <p className="text-slate-500">Database Size</p>
                    <p className="text-slate-900 font-semibold text-lg">{connectedDbInfo.size}</p>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-lg col-span-1 md:col-span-3">
                     <p className="text-slate-600 mb-2 flex items-center gap-2 font-medium"><ServerIcon className="w-4 h-4" /> Collections</p>
                     <div className="flex flex-wrap gap-2">
                       {connectedDbInfo.collections.map(col => (
                         <button 
                            key={col} 
                            onClick={() => handleCollectionClick(col)}
                            className={`text-xs font-mono px-3 py-1 rounded-full transition-all duration-200 ${selectedCollection === col ? 'bg-blue-500 text-white font-bold ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                        >
                            {col}
                         </button>
                       ))}
                     </div>
                  </div>
                </div>
                 {/* Collection Action Panel */}
                 {(isFetchingCollectionInfo || collectionInfo || collectionInfoError) && (
                    <div className="mt-4">
                        {isFetchingCollectionInfo && <div className="text-center p-4 text-slate-500">Fetching collection details...</div>}
                        {collectionInfoError && <p className="text-red-600 text-sm mt-2">{collectionInfoError}</p>}
                        {collectionInfo && selectedCollection === collectionInfo.name && (
                            <CollectionActionPanel
                                info={collectionInfo}
                                onGenerate={handleGenerateCollectionQuery}
                                onClose={() => { setSelectedCollection(null); setCollectionInfo(null); }}
                                isLoading={isLoading}
                            />
                        )}
                    </div>
                 )}
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><DatabaseIcon className="w-6 h-6 text-blue-500"/> Connect to a Database</h2>
                <div className="mt-4 flex items-stretch gap-2">
                  <select
                    value={selectedDb}
                    onChange={(e) => setSelectedDb(e.target.value)}
                    disabled={isConnecting || isLoadingDbs || availableDbs.length === 0}
                    className="flex-grow p-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                  >
                    {isLoadingDbs ? (
                      <option>Loading databases...</option>
                    ) : availableDbs.length > 0 ? (
                      availableDbs.map(db => (
                        <option key={db.name} value={db.name}>{db.name}</option>
                      ))
                    ) : (
                      <option>No databases found</option>
                    )}
                  </select>
                  <button onClick={handleConnect} disabled={isConnecting || isLoadingDbs || !selectedDb} className="px-5 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
                {dbError && <p className="text-red-600 text-sm mt-2">{dbError}</p>}
              </div>
            )}
          </div>

          {/* Query Generator */}
          <div className={`bg-white rounded-xl shadow-md p-6 transition-opacity duration-500 ${isQuerySectionDisabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="space-y-4">
              <label htmlFor="userInput" className="block text-lg font-medium text-slate-700">
                Enter your command:
              </label>
              <textarea
                id="userInput"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={isQuerySectionDisabled ? "Connect to a database to begin..." : "e.g., 'Find all users from Canada and sort them by name'"}
                className="w-full h-28 p-4 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-slate-400 resize-none"
                disabled={isLoading || isQuerySectionDisabled}
              />
              <button
                onClick={handleMainGenerateClick}
                disabled={isLoading || !userInput.trim() || isQuerySectionDisabled}
                className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99]"
              >
                {isLoading ? 'Generating...' : 'Generate Query'}
              </button>
            </div>

            <div className="mt-8">
              {isLoading && <Loader />}
              {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fade-in" role="alert">
                      <strong className="font-bold">Error: </strong>
                      <span className="block sm:inline">{error}</span>
                  </div>
              )}
              {!isLoading && !error && queryResult && (
                <div className="space-y-8">
                    <QueryDisplay
                        intentSummary={queryResult.intent_summary}
                        confirmationPrompt={queryResult.confirmation_prompt}
                        code={editableCode}
                        onCodeChange={setEditableCode}
                        onRunQuery={handleRunQuery}
                        isExecuting={isExecuting}
                    />
                    <QueryResult
                        isExecuting={isExecuting}
                        executionError={executionError}
                        executionResult={executionResult}
                    />
                </div>
              )}
              {!isLoading && !error && !queryResult && (
                <div className="text-center text-slate-500 py-10 border-2 border-dashed border-slate-300 rounded-lg">
                  <p>{isQuerySectionDisabled ? 'Connect to a database to generate queries.' : 'Your generated query will appear here.'}</p>
                </div>
              )}
            </div>
          </div>
        </main>
        
        <footer className="text-center mt-8 text-slate-500 text-sm">
          <p>Powered by Google Gemini. For demonstration purposes only.</p>
        </footer>
      </div>
       <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }
      `}</style>
    </div>
  );
};

export default QueryGeneratorPage;