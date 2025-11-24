import React from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import Layout from '../components/Layout';
import MeetingForm from '../components/MeetingForm';

export default function Schedule() {
    const isAuthenticated = useIsAuthenticated();

    return (
        <Layout>
            {!isAuthenticated ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h2 style={{ color: '#2d3748', marginBottom: '1rem' }}>Authentication Required</h2>
                    <p style={{ color: '#718096' }}>
                        Please sign in with your Microsoft account to schedule meetings
                    </p>
                </div>
            ) : (
                <MeetingForm />
            )}
        </Layout>
    );
}
