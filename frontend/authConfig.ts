import { Configuration, PublicClientApplication } from "@azure/msal-browser";

/**
 * Configuration object to be passed to MSAL instance on creation. 
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md 
 */
export const msalConfig: Configuration = {
    auth: {
        clientId: "6a136cee-b760-41a0-a039-b92ee63f1320", // This is the ONLY mandatory field that you need to supply.
        authority: "https://login.microsoftonline.com/0851d291-32a7-4681-b8dd-491bc4bd6ea5", // Or "consumers" for personal accounts, or "organizations" for multi-tenant.
        redirectUri: "http://localhost:5173/", // You must register this URI on Azure Portal/App Registration.
        postLogoutRedirectUri: "/", // Indicates the page to navigate to after logout.
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit: 
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest = {
  scopes: ["api://6a136cee-b760-41a0-a039-b92ee63f1320/access_as_user"]
};

/**
 * An instance of PublicClientApplication is created here.
 * It is used to handle authentication requests.
 */
export const msalInstance = new PublicClientApplication(msalConfig);
