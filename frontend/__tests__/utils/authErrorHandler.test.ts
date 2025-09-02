import { describe, it, expect } from 'vitest';
import { isAuthenticationExpiredError, getAuthErrorMessage, shouldRedirectToLogin } from '../../utils/authErrorHandler';

describe('authErrorHandler', () => {
  describe('isAuthenticationExpiredError', () => {
    it('should return true for InteractionRequiredAuthError-like objects', () => {
      const error = {
        name: 'InteractionRequiredAuthError',
        message: 'interaction_required: AADSTS160021: Application requested a user session which does not exist'
      };
      expect(isAuthenticationExpiredError(error)).toBe(true);
    });

    it('should return true for messages containing AADSTS160021', () => {
      const error = new Error('interaction_required: AADSTS160021: Application requested a user session which does not exist');
      expect(isAuthenticationExpiredError(error)).toBe(true);
    });

    it('should return true for session expired patterns', () => {
      const error = new Error('user session which does not exist');
      expect(isAuthenticationExpiredError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Network error');
      expect(isAuthenticationExpiredError(error)).toBe(false);
    });
  });

  describe('getAuthErrorMessage', () => {
    it('should return session expired message for authentication errors', () => {
      const error = new Error('AADSTS160021: Application requested a user session which does not exist');
      const message = getAuthErrorMessage(error);
      expect(message).toBe('Your session has expired. Please sign out and sign in again to continue.');
    });

    it('should return permission message for 403 errors', () => {
      const error = new Error('403 Forbidden');
      const message = getAuthErrorMessage(error);
      expect(message).toBe("You don't have permission to access this resource. Please check your permissions or contact your administrator.");
    });

    it('should return default auth error message for other errors', () => {
      const error = new Error('Some other error');
      const message = getAuthErrorMessage(error);
      expect(message).toBe('Some other error');
    });
  });

  describe('shouldRedirectToLogin', () => {
    it('should return true for authentication expired errors', () => {
      const error = new Error('AADSTS160021: Application requested a user session which does not exist');
      expect(shouldRedirectToLogin(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Network error');
      expect(shouldRedirectToLogin(error)).toBe(false);
    });
  });
});
