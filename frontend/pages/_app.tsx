import type { AppProps } from 'next/app';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '../lib/msalConfig';
import '../styles/globals.css';

const msalInstance = new PublicClientApplication(msalConfig);

export default function App({ Component, pageProps }: AppProps) {
    return (
        <MsalProvider instance={msalInstance}>
            <Component {...pageProps} />
        </MsalProvider>
    );
}
