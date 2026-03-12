import { msalInstance, loginRequest } from '../authConfig';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

class TokenRenewalService {
    private renewalInterval: NodeJS.Timeout | null = null;
    private isRenewing = false;
    private readonly RENEWAL_INTERVAL = 30 * 60 * 1000; // 30 minutes
    /**
     * Start the token renewal service
     */
    public start(): void {
        if (this.renewalInterval) {
            this.stop(); // Clear existing interval
        }

        console.log('Starting token renewal service...');

        // Initial token check
        this.renewTokenIfNeeded();

        // Set up periodic renewal
        this.renewalInterval = setInterval(() => {
            this.renewTokenIfNeeded();
        }, this.RENEWAL_INTERVAL);
    }

    /**
     * Stop the token renewal service
     */
    public stop(): void {
        if (this.renewalInterval) {
            clearInterval(this.renewalInterval);
            this.renewalInterval = null;
            console.log('Token renewal service stopped');
        }
    }

    /**
     * Manually trigger token renewal
     */
    public async renewToken(): Promise<boolean> {
        return this.renewTokenIfNeeded();
    }

    /**
     * Check if token needs renewal and renew if necessary
     */
    private async renewTokenIfNeeded(): Promise<boolean> {
        if (this.isRenewing) {
            console.log('Token renewal already in progress, skipping...');
            return false;
        }

        try {
            this.isRenewing = true;

            const accounts = msalInstance.getAllAccounts();
            if (accounts.length === 0) {
                console.log('No accounts found, cannot renew token');
                return false;
            }

            const account = accounts[0];

            // Check if token is close to expiry
            if (!this.isTokenNearExpiry(account)) {
                console.log('Token is still valid, no renewal needed');
                return true;
            }

            console.log('Token is near expiry, attempting silent renewal...');

            // Attempt silent token renewal
            await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: account,
            });

            console.log('Token renewed successfully via silent request');
            return true;

        } catch (error) {
            console.warn('Silent token renewal failed:', error);

            if (error instanceof InteractionRequiredAuthError) {
                console.log('Interactive authentication required - user will need to sign in again on next request');
                // Don't trigger popup automatically as it might be disruptive
                // Let the user-triggered request handle the interactive flow
            }

            return false;
        } finally {
            this.isRenewing = false;
        }
    }

    /**
     * Check if the current token is near expiry
     */
    private isTokenNearExpiry(_account: any): boolean {
        // Always attempt renewal for proactive refreshing
        // MSAL handles token expiry checks internally, so we'll rely on forceRefresh
        return true;
    }

    /**
     * Get the renewal interval in milliseconds
     */
    public getRenewalInterval(): number {
        return this.RENEWAL_INTERVAL;
    }

    /**
     * Check if the service is currently running
     */
    public isRunning(): boolean {
        return this.renewalInterval !== null;
    }
}

// Export a singleton instance
export const tokenRenewalService = new TokenRenewalService();