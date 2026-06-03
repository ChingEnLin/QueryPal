import { useCallback } from 'react';
import { useMsal } from "@azure/msal-react";
import { useAuth as useContextAuth } from '../contexts/AuthContext';
import { USE_MSAL_AUTH } from '../app.config';
import { loginRequest } from '../authConfig';

export interface UnifiedUser {
    name?: string;
    email?: string;
    roles?: string[];
}

export const useUnifiedAuth = () => {
    // We cannot conditionally call hooks, so we call both and ignore the one we don't need
    // This assumes that calling useAuth when AuthProvider is missing throws, which is the problem.
    // So we CANNOT call useContextAuth if USE_MSAL_AUTH is true.

    // HOWEVER, hooks must be called unconditionally.
    // The only way to solve this without refactoring the Provider structure is to:
    // 1. Create a SafeAuthProvider that always exists?
    // 2. Or, since we know USE_MSAL_AUTH is a build-time constant (or runtime constant), 
    //    we technically can branch IF the hook implementation allows it, but React forbids it.

    // BUT, since USE_MSAL_AUTH is constant, we can create two different hook implementations
    // and export the correct one.
    return USE_MSAL_AUTH ? useMsalAuth() : useBypassAuth();
};

const useMsalAuth = () => {
    const { instance, accounts } = useMsal();
    const account = accounts[0];

    const logout = useCallback(() => {
        instance.logoutRedirect({ postLogoutRedirectUri: "/" });
    }, [instance]);

    const getToken = useCallback(async () => {
        if (!account) return null;
        try {
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: account
            });
            return response.accessToken;
        } catch (error) {
            console.error("Token acquisition failed", error);
            throw error;
        }
    }, [instance, account]);

    const roles = ((account?.idTokenClaims as { roles?: string[] } | undefined)?.roles) ?? [];

    return {
        user: account ? { name: account.name, email: account.username, roles } : null,
        logout,
        getToken,
        isAuthenticated: !!account
    };
};

const useBypassAuth = () => {
    // This will only be called if USE_MSAL_AUTH is false, 
    // so AuthProvider should be present in the tree.
    // We need to suppress the error if we are checking types, but at runtime it should be fine.
    // However, if we import this file, standard React rules apply. 
    // Since useUnifiedAuth returns one of them, the Call Graph is static.

    const { user, logout: contextLogout, isAuthenticated } = useContextAuth();

    const getToken = useCallback(async () => {
        // In bypass mode, return a dummy token or null
        // Backend should be configured to accept it or we mock the API response
        return "bypass-token";
    }, []);

    return {
        user: user ? { ...user, roles: ['Admin'] } : null,
        logout: contextLogout,
        getToken,
        isAuthenticated
    };
};
