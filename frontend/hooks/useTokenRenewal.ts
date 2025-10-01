import { useEffect } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import { tokenRenewalService } from '../services/tokenRenewalService';
import { USE_MSAL_AUTH } from '../app.config';

/**
 * Custom hook to manage token renewal for authenticated users
 * Automatically starts/stops the renewal service based on authentication state
 */
export const useTokenRenewal = (): void => {
    const isAuthenticated = useIsAuthenticated();

    useEffect(() => {
        // Only manage token renewal when using MSAL auth
        if (!USE_MSAL_AUTH) {
            return;
        }

        if (isAuthenticated) {
            console.log('User authenticated, starting token renewal service');
            tokenRenewalService.start();
        } else {
            console.log('User not authenticated, stopping token renewal service');
            tokenRenewalService.stop();
        }

        // Cleanup on unmount
        return () => {
            tokenRenewalService.stop();
        };
    }, [isAuthenticated]);
};