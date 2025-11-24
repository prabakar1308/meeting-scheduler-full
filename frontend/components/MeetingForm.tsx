import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { api, setAuthToken } from '../lib/api';
import { loginRequest } from '../lib/msalConfig';
import SimpleMode from './SimpleMode';
import AdvancedMode from './AdvancedMode';

interface MeetingSuggestion {
    rank: number;
    start: string;
    end: string;
    score: number;
    reason: string;
    hasExternalAttendees?: boolean;
    externalAttendeeCount?: number;
    note?: string;
}

export default function MeetingForm() {
    const { instance, accounts } = useMsal();
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    const [suggestions, setSuggestions] = useState<MeetingSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSchedule = async (suggestion: MeetingSuggestion) => {
        setLoading(true);
        setError('');

        try {
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });
            setAuthToken(response.accessToken);

            await api.scheduleMeeting({
                subject: 'Meeting', // Default subject for advanced mode
                attendees: [],
                start: suggestion.start,
                end: suggestion.end,
                createIfFree: false,
            });

            alert('Meeting scheduled successfully!');
            setSuggestions([]);
        } catch (err: any) {
            setError(err.message || 'Failed to schedule meeting');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Schedule a Meeting</h2>

                {/* Mode Toggle */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setMode('simple')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: mode === 'simple' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
                            color: mode === 'simple' ? 'white' : '#4a5568',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                        }}
                    >
                        ✨ Simple Mode
                    </button>
                    <button
                        onClick={() => setMode('advanced')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: mode === 'advanced' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
                            color: mode === 'advanced' ? 'white' : '#4a5568',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                        }}
                    >
                        ⚙️ Advanced Mode
                    </button>
                </div>

                {mode === 'simple' ? (
                    <SimpleMode
                        onError={setError}
                        onSuccess={() => {
                            setError('');
                            setSuggestions([]);
                        }}
                    />
                ) : (
                    <AdvancedMode
                        onError={setError}
                        onSuggestions={setSuggestions}
                    />
                )}

                {error && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: '#fed7d7',
                        color: '#c53030',
                        borderRadius: '6px'
                    }}>
                        {error}
                    </div>
                )}
            </div>

            {suggestions.length > 0 && (
                <div style={{
                    marginTop: '2rem',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '2rem',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ marginTop: 0, color: '#2d3748' }}>Suggested Meeting Times</h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: '1rem',
                                    border: suggestion.hasExternalAttendees ? '2px solid #f6ad55' : '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: suggestion.hasExternalAttendees ? '#fffaf0' : 'white'
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <div style={{ fontWeight: 'bold', color: '#2d3748' }}>
                                            Rank #{suggestion.rank} (Score: {suggestion.score}%)
                                        </div>
                                        {suggestion.hasExternalAttendees && (
                                            <span style={{
                                                fontSize: '0.75rem',
                                                background: '#feebc8',
                                                color: '#dd6b20',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontWeight: 'bold'
                                            }}>
                                                🌐 {suggestion.externalAttendeeCount} External
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ color: '#4a5568', fontSize: '0.875rem' }}>
                                        {new Date(suggestion.start).toLocaleString('en-IN', {
                                            timeZone: 'Asia/Kolkata',
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })} - {new Date(suggestion.end).toLocaleString('en-IN', {
                                            timeZone: 'Asia/Kolkata',
                                            timeStyle: 'short'
                                        })}
                                    </div>
                                    <div style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                        {suggestion.reason}
                                    </div>
                                    {suggestion.note && (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '0.5rem',
                                            background: '#feebc8',
                                            color: '#744210',
                                            fontSize: '0.75rem',
                                            borderRadius: '4px',
                                            borderLeft: '3px solid #f6ad55'
                                        }}>
                                            ℹ️ {suggestion.note}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleSchedule(suggestion)}
                                    disabled={loading}
                                    style={{
                                        background: '#48bb78',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '6px',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold',
                                        marginLeft: '1rem'
                                    }}
                                >
                                    Schedule
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
