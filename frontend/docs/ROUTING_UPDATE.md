# QueryPal Frontend Routing Update

## Overview
The frontend has been restructured to use proper URL-based routing with React Router instead of the previous component-based navigation.

## New URL Structure

### Routes
- `/` - Redirects to `/login`
- `/login` - Login page for authentication
- `/query-generator` - Main query generator interface (protected)
- `/data-explorer/:accountId/:databaseName` - Data explorer with database connection info in URL (protected)
- `*` - Any other route redirects to `/login`

### Route Parameters
The data explorer route includes URL parameters:
- `:accountId` - The Azure Cosmos DB account ID (URL encoded)
- `:databaseName` - The database name (URL encoded)

## Components

### New Components
- `ProtectedRoute.tsx` - Higher-order component that ensures authentication before accessing protected routes
- `QueryGeneratorPageWrapper.tsx` - Wrapper that provides authentication context and navigation logic to QueryGeneratorPage
- `DataExplorerPageWrapper.tsx` - Wrapper that extracts URL parameters and manages state for DataExplorerPage

### Updated Components
- `App.tsx` - Now uses RouterProvider instead of manual component switching
- `LoginPage.tsx` - Added navigation logic after successful authentication
- `router.tsx` - Central routing configuration

## Navigation Flow

### Login Flow
1. User visits any URL
2. If not authenticated, redirected to `/login`
3. After successful authentication, redirected to `/query-generator`

### Query Generator to Data Explorer
1. User selects database connection in Query Generator
2. Navigation uses `navigate()` with URL parameters: `/data-explorer/{accountId}/{databaseName}`
3. Connection state passed via `location.state` for immediate availability
4. If state is missing, DataExplorerPageWrapper fetches required data

### Data Explorer Back Navigation
1. "Back" button navigates to `/query-generator`
2. Connection state is lost (by design - fresh start)

## Benefits

### URL Bookmarking
- Users can bookmark specific database explorer URLs
- Direct navigation to database explorer with proper parameters

### Browser Navigation
- Browser back/forward buttons work correctly
- URL reflects current application state

### State Management
- URL parameters contain essential connection information
- Additional state passed via React Router's `location.state`
- Fallback data fetching if state is missing

## Technical Implementation

### Authentication Handling
- MSAL authentication: Uses `useIsAuthenticated()` hook
- Bypass authentication: Uses custom `useAuth()` context
- Both handled by `ProtectedRoute` component

### Data Flow
1. **Query Generator** → collects connection data → navigates with parameters and state
2. **Data Explorer** → extracts parameters → uses passed state or fetches data
3. **Fallback** → if parameters invalid → redirects to Query Generator

### Error Handling
- Invalid account/database parameters trigger error state
- Loading states during data fetching
- Graceful fallback to Query Generator on errors

## Usage Examples

### Direct URL Access
```
http://localhost:5173/data-explorer/myaccount/mydatabase
```
This URL will load the data explorer for the specified account and database.

### Programmatic Navigation
```typescript
navigate(`/data-explorer/${encodeURIComponent(accountId)}/${encodeURIComponent(databaseName)}`, {
  state: { dbInfo, accountName, availableDbs, availableAccounts }
});
```

## Future Enhancements

### Potential Additions
- Query parameters for filters, search terms
- Collection-specific URLs: `/data-explorer/:accountId/:databaseName/:collectionName`
- Breadcrumb navigation with URL state
- Deep linking to specific documents
