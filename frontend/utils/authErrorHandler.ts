import { InteractionRequiredAuthError, AuthError } from '@azure/msal-browser';

/**
 * Check if an error is an authentication-related error that suggests the user needs to re-authenticate
 */
export const isAuthenticationExpiredError = (error: any): boolean => {
  // MSAL InteractionRequiredAuthError
  if (error instanceof InteractionRequiredAuthError) {
    return true;
  }

  // Check for specific error codes that indicate session expiration
  if (error instanceof AuthError) {
    // Common MSAL error codes for expired sessions
    const expiredSessionCodes = [
      'interaction_required',
      'invalid_grant',
      'token_expired',
      'refresh_token_expired'
    ];
    return expiredSessionCodes.some(code => error.errorCode?.includes(code));
  }

  // Check error message for AADSTS codes that indicate session issues
  if (typeof error === 'object' && error?.message) {
    const errorMessage = error.message.toLowerCase();

    // AADSTS160021: User session does not exist
    // AADSTS50078: User session has expired
    // AADSTS50079: User is required to enroll in multifactor authentication
    // AADSTS700082: The refresh token has expired
    const sessionExpiredPatterns = [
      'aadsts160021', // Application requested a user session which does not exist
      'aadsts50078', // User session has expired  
      'aadsts700082', // The refresh token has expired
      'interaction_required',
      'user session which does not exist',
      'session has expired',
      'refresh token has expired',
      'monitor_window_timeout'
    ];

    return sessionExpiredPatterns.some(pattern => errorMessage.includes(pattern));
  }

  return false;
};

/**
 * Check if an error is recoverable through interactive authentication (popup/redirect)
 */
export const isRecoverableAuthError = (error: any): boolean => {
  if (error instanceof InteractionRequiredAuthError) {
    return true;
  }

  if (error instanceof AuthError) {
    const recoverableCodes = [
      'interaction_required',
      'consent_required',
      'login_required',
      'monitor_window_timeout'
    ];
    return recoverableCodes.some(code => error.errorCode?.includes(code));
  }

  return false;
};

/**
 * Get a user-friendly error message for authentication errors
 */
export const getAuthErrorMessage = (error: any): string => {
  if (isAuthenticationExpiredError(error)) {
    return "Your session has expired. Please sign out and sign in again to continue.";
  }

  // Handle other authentication-related errors
  if (error instanceof AuthError) {
    switch (error.errorCode) {
      case 'user_cancelled':
        return "Sign-in was cancelled. Please try signing in again.";
      case 'consent_required':
        return "Additional permissions are required. Please sign in again to grant consent.";
      case 'no_account_found':
        return "No account found. Please sign in to continue.";
      default:
        return "Authentication failed. Please sign out and sign in again.";
    }
  }

  // Handle HTTP errors that might be authentication related
  if (typeof error === 'object' && error?.message) {
    const message = error.message.toLowerCase();

    if (message.includes('401') || message.includes('unauthorized')) {
      return "Your session has expired. Please sign out and sign in again to continue.";
    }

    if (message.includes('403') || message.includes('forbidden')) {
      return "You don't have permission to access this resource. Please check your permissions or contact your administrator.";
    }
  }

  return error?.message || "An authentication error occurred. Please sign out and sign in again.";
};

/**
 * Check if an error suggests the user should be redirected to login
 */
export const shouldRedirectToLogin = (error: any): boolean => {
  return isAuthenticationExpiredError(error) ||
    (error instanceof AuthError && error.errorCode === 'no_account_found');
};
