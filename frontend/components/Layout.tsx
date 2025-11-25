import React, { ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../lib/msalConfig';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const handleLogin = () => {
        instance.loginPopup(loginRequest).catch((e) => {
            console.error('Login failed:', e);
        });
    };

    const handleLogout = () => {
        instance.logoutPopup().catch((e) => {
            console.error('Logout failed:', e);
        });
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '1rem 2rem',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                        📅 Meeting Scheduler
                    </h1>
                    {isAuthenticated && (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <a href="/" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                                Dashboard
                            </a>
                            <a href="/schedule" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                                Schedule Meeting
                            </a>
                            <a href="/chat" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                                💬 Chat
                            </a>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {isAuthenticated ? (
                        <>
                            <span style={{ opacity: 0.9 }}>
                                👤 {accounts[0]?.name || accounts[0]?.username}
                            </span>
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleLogin}
                            style={{
                                background: 'white',
                                border: 'none',
                                color: '#667eea',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                        >
                            Sign in with Microsoft
                        </button>
                    )}
                </div>
            </nav>
            <main style={{ flex: 1, padding: '2rem', background: '#f7fafc' }}>
                {children}
            </main>
            <footer style={{
                background: '#2d3748',
                color: 'white',
                padding: '1rem',
                textAlign: 'center',
                opacity: 0.8
            }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    Meeting Scheduler © 2025 | Powered by Azure AD & Microsoft Graph
                </p>
            </footer>
        </div>
    );
}
