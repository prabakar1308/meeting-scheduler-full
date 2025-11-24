import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { api, setAuthToken } from '../lib/api';
import { loginRequest } from '../lib/msalConfig';
import { format, addDays } from 'date-fns';

interface MeetingSuggestion {
    rank: number;
    start: string;
    end: string;
    score: number;
    reason: string;
}

export default function MeetingForm() {
    const { instance, accounts } = useMsal();
    const [attendees, setAttendees] = useState<string[]>(['']);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [suggestions, setSuggestions] = useState<MeetingSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const addAttendee = () => {
        setAttendees([...attendees, '']);
    };

    const updateAttendee = (index: number, value: string) => {
        const newAttendees = [...attendees];
        newAttendees[index] = value;
        setAttendees(newAttendees);
    };

    const removeAttendee = (index: number) => {
        setAttendees(attendees.filter((_, i) => i !== index));
    };

    const handleSuggest = async () => {
        setLoading(true);
        setError('');
        setSuggestions([]);

        try {
            // Get access token
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });
            setAuthToken(response.accessToken);

            // Call API
            const validAttendees = attendees.filter(email => email.trim());
            const result = await api.suggestMeetings({
                attendees: validAttendees.map(email => ({
                    emailAddress: { address: email.trim() }
                })),
                start: `${startDate}T09:00:00Z`,
                end: `${endDate}T17:00:00Z`,
            });

            setSuggestions(result);
        } catch (err: any) {
            setError(err.message || 'Failed to get suggestions');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSchedule = async (suggestion: MeetingSuggestion) => {
        setLoading(true);
        setError('');

        try {
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });
            setAuthToken(response.accessToken);

            const validAttendees = attendees.filter(email => email.trim());
            await api.scheduleMeeting({
                attendees: validAttendees.map(email => ({
                    emailAddress: { address: email.trim() }
                })),
                start: suggestion.start,
                end: suggestion.end,
                createIfFree: true,
            });

            alert('Meeting scheduled successfully!');
            setSuggestions([]);
            setAttendees(['']);
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

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                        Attendees
                    </label>
                    {attendees.map((email, index) => (
                        <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => updateAttendee(index, e.target.value)}
                                placeholder="attendee@example.com"
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '1rem'
                                }}
                            />
                            {attendees.length > 1 && (
                                <button
                                    onClick={() => removeAttendee(index)}
                                    style={{
                                        background: '#fc8181',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={addAttendee}
                        style={{
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginTop: '0.5rem'
                        }}
                    >
                        + Add Attendee
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                </div>

                <button
                    onClick={handleSuggest}
                    disabled={loading || attendees.filter(e => e.trim()).length === 0}
                    style={{
                        background: loading ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        width: '100%',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    {loading ? 'Loading...' : 'Get Meeting Suggestions'}
                </button>

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
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#2d3748', marginBottom: '0.25rem' }}>
                                        Rank #{suggestion.rank} (Score: {(suggestion.score * 100).toFixed(0)}%)
                                    </div>
                                    <div style={{ color: '#4a5568', fontSize: '0.875rem' }}>
                                        {new Date(suggestion.start).toLocaleString()} - {new Date(suggestion.end).toLocaleTimeString()}
                                    </div>
                                    <div style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                        {suggestion.reason}
                                    </div>
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
                                        fontWeight: 'bold'
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
