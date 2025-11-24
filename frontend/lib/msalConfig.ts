export const msalConfig = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    },
    cache: {
        cacheLocation: 'sessionStorage' as const,
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Calendars.ReadWrite'],
};
