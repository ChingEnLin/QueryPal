/**
 * Toggles the authentication mode for the application.
 * - Set to `true` to use Microsoft Entra ID (MSAL) for real authentication.
 * - Set to `false` to use a local bypass authentication for development purposes.
 * 
 * The bypass allows developers to work on features without needing to
 * configure or sign into an Azure account.
 */
export const USE_MSAL_AUTH = true;
