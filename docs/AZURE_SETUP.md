# Azure Setup

## 1. Entra ID App Registrations

You need two app registrations: one for the frontend SPA and one for the backend confidential client.

### Frontend (SPA)

1. Go to Azure Portal → App Registrations → New registration
2. Name: `QueryPal Frontend`, Platform: Single-page application
3. Redirect URI: `http://localhost:5173` (dev) / your production URL
4. Note the **Application (client) ID** and **Directory (tenant) ID**

### Backend (Confidential Client)

1. New registration — Name: `QueryPal Backend`, Client type: Confidential client
2. Add a **client secret** under Certificates & secrets
3. Expose an API:
   - Application ID URI: `api://<backend-client-id>`
   - Add scope: `access_as_user`
   - Add the frontend app as an authorized client application

### API Permissions (both apps)

- `Microsoft Graph` → `User.Read`
- `Azure Service Management` → `user_impersonation`
- Grant admin consent for your organization

---

## 2. Cosmos DB Access

Grant the backend application read access to your Cosmos DB account:

1. Go to your Cosmos DB account → Access control (IAM)
2. Add role assignment:
   - Role: `Cosmos DB Account Reader Role`
   - Assign to: your backend app registration (service principal)

---

## 3. Frontend Configuration

Update `frontend/authConfig.ts`:

```typescript
export const msalConfig = {
  auth: {
    clientId: "your-frontend-client-id",
    authority: "https://login.microsoftonline.com/your-tenant-id",
    redirectUri: "http://localhost:5173",
  },
};

export const loginRequest = {
  scopes: ["User.Read", "api://your-backend-client-id/access_as_user"],
};
```

---

## 4. Backend Environment Variables

```env
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_backend_client_id
AZURE_CLIENT_SECRET=your_client_secret
ARM_SCOPE=https://management.azure.com/.default
```

In production these are sourced from GCP Secret Manager — see [INFRASTRUCTURE.md](INFRASTRUCTURE.md#secret-management).
