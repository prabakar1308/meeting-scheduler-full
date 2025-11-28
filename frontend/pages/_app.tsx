import type { AppProps } from 'next/app';
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../lib/msalConfig';
import { setAuthToken } from '../lib/api';
import { useEffect } from 'react';
import '../styles/globals.css';

const msalInstance = new PublicClientApplication(msalConfig);

function AuthTokenManager({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();

    useEffect(() => {
        const acquireToken = async () => {
            if (isAuthenticated && accounts.length > 0) {
                try {
                    const response = await instance.acquireTokenSilent({
                        ...loginRequest,
                        account: accounts[0]
                    });
                    setAuthToken(response.accessToken);
                    console.log('✅ Auth token set for API requests');
                } catch (error) {
                    console.error('Failed to acquire token:', error);
                    setAuthToken(null);
                }
            } else {
                setAuthToken(null);
            }
        };

        acquireToken();
    }, [isAuthenticated, accounts, instance]);

    return <>{children}</>;
}

import { TeamsProvider } from '../components/TeamsProvider';

// ... (imports)

export default function App({ Component, pageProps }: AppProps) {
    return (
        <MsalProvider instance={msalInstance}>
            <TeamsProvider>
                <AuthTokenManager>
                    <Component {...pageProps} />
                </AuthTokenManager>
            </TeamsProvider>
        </MsalProvider>
    );
}
