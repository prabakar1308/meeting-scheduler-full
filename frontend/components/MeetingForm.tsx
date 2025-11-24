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
    hasExternalAttendees?: boolean;
    externalAttendeeCount?: number;
    note?: string;
}

export default function MeetingForm() {
    const { instance, accounts } = useMsal();
    const [attendees, setAttendees] = useState<string[]>(['']);
    // Default to today and tomorrow - validation will check actual time
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [suggestions, setSuggestions] = useState<MeetingSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Helper to detect if an email is external
    const isExternalUser = (email: string): boolean => {
        const userEmail = accounts[0]?.username || '';
        const userDomain = userEmail.split('@')[1];
        const attendeeDomain = email.split('@')[1];
        return userDomain !== attendeeDomain;
    };

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
            // Validate dates are in the future (timestamp-specific validation)
            // Using IST timezone: 10:00 AM to 9:00 PM (Asia/Kolkata)
            // IST is UTC+5:30, so:
            // 10:00 AM IST = 04:30 UTC
            // 9:00 PM IST = 15:30 UTC
            const now = new Date();
            const today = format(new Date(), 'yyyy-MM-dd');

            // Smart time logic:
            // - If startDate is today, use current time
            // - If startDate is in the future, use 10:00 AM IST (04:30 UTC)
            let start: Date;
            console.log(startDate === today)
            if (startDate === today) {
                // For today, use current time
                start = new Date();
            } else {
                // For future dates, use 10:00 AM IST
                start = new Date(`${startDate}T04:30:00Z`);
            }

            // End time is always 9:00 PM IST (15:30 UTC)
            const end = new Date(`${endDate}T15:30:00Z`);

            if (start < now) {
                const timeMsg = startDate === today
                    ? 'current time'
                    : `${startDate} 10:00 AM IST`;
                setError(`Start time (${timeMsg}) has already passed. Please select a future date or time.`);
                setLoading(false);
                return;
            }

            if (end <= now) {
                setError(`End time (${endDate} 9:00 PM IST) has already passed. Please select a future date.`);
                setLoading(false);
                return;
            }

            if (start >= end) {
                setError('End date must be after start date');
                setLoading(false);
                return;
            }

            // Get access token
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });
            setAuthToken(response.accessToken);

            // Call API with IST times
            // Smart time logic: if today, use current time; if future, use 10 AM IST
            const validAttendees = attendees.filter(email => email.trim());

            let apiStartTime: string;
            if (startDate === today) {
                // For today, use current time (already in the future from validation)
                apiStartTime = now.toISOString();
            } else {
                // For future dates, use 10:00 AM IST (04:30 UTC)
                apiStartTime = `${startDate}T04:30:00Z`;
            }

            const result = await api.suggestMeetings({
                attendees: validAttendees.map(email => ({
                    emailAddress: { address: email.trim() }
                })),
                start: apiStartTime,
                end: `${endDate}T15:30:00Z`,     // 9:00 PM IST
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
                <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1.5rem' }}>
                    ⏰ Meeting times: 10:00 AM - 9:00 PM IST
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                        Attendees
                    </label>
                    <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.5rem' }}>
                        💡 Internal users (same domain) will have availability checked. External users will receive invitations only.
                    </div>
                    {attendees.map((email, index) => {
                        const isExternal = email.trim() && isExternalUser(email.trim());
                        return (
                            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => updateAttendee(index, e.target.value)}
                                    placeholder="attendee@example.com"
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        border: isExternal ? '2px solid #f6ad55' : '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '1rem',
                                        background: isExternal ? '#fffaf0' : 'white'
                                    }}
                                />
                                {isExternal && (
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: '#dd6b20',
                                        background: '#feebc8',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        🌐 External
                                    </span>
                                )}
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
                        );
                    })}
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
                            min={format(new Date(), 'yyyy-MM-dd')}
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
                            min={startDate || format(new Date(), 'yyyy-MM-dd')}
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
