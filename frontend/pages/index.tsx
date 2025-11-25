import React from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import Layout from '../components/Layout';

export default function Home() {
    const isAuthenticated = useIsAuthenticated();

    return (
        <Layout>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {!isAuthenticated ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem 2rem',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📅</div>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748' }}>
                            Welcome to Meeting Scheduler
                        </h1>
                        <p style={{ fontSize: '1.25rem', color: '#718096', marginBottom: '2rem' }}>
                            Schedule meetings intelligently with AI-powered suggestions
                        </p>
                        <p style={{ color: '#4a5568' }}>
                            Please sign in with your Microsoft account to get started
                        </p>
                    </div>
                ) : (
                    <div>
                        <div style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '2rem',
                            marginBottom: '2rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>
                            <h2 style={{ marginTop: 0, color: '#2d3748' }}>Welcome back! 👋</h2>
                            <p style={{ color: '#718096', marginBottom: '2rem' }}>
                                Ready to schedule your next meeting?
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <a
                                    href="/schedule"
                                    style={{
                                        display: 'inline-block',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        padding: '1rem 2rem',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    📅 Schedule a Meeting →
                                </a>
                                <a
                                    href="/chat"
                                    style={{
                                        display: 'inline-block',
                                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                        color: 'white',
                                        padding: '1rem 2rem',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    💬 Chat Assistant →
                                </a>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '1.5rem'
                        }}>
                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
                                <h3 style={{ marginTop: 0, color: '#2d3748' }}>AI-Powered Suggestions</h3>
                                <p style={{ color: '#718096', fontSize: '0.875rem' }}>
                                    Get intelligent meeting time suggestions based on everyone's availability
                                </p>
                            </div>

                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
                                <h3 style={{ marginTop: 0, color: '#2d3748' }}>Secure Authentication</h3>
                                <p style={{ color: '#718096', fontSize: '0.875rem' }}>
                                    Protected by Azure AD with your Microsoft account
                                </p>
                            </div>

                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
                                <h3 style={{ marginTop: 0, color: '#2d3748' }}>Quick Scheduling</h3>
                                <p style={{ color: '#718096', fontSize: '0.875rem' }}>
                                    Schedule meetings in seconds with one-click booking
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
