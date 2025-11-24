import React from 'react';
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

interface AdvancedModeProps {
    onError: (error: string) => void;
    onSuggestions: (suggestions: MeetingSuggestion[]) => void;
}

export default function AdvancedMode({ onError, onSuggestions }: AdvancedModeProps) {
    const { instance, accounts } = useMsal();
    const [attendees, setAttendees] = React.useState<string[]>(['']);
    const [startDate, setStartDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = React.useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [loading, setLoading] = React.useState(false);

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
        onError('');
        onSuggestions([]);

        try {
            const now = new Date();
            const today = format(new Date(), 'yyyy-MM-dd');

            let start: Date;
            if (startDate === today) {
                start = new Date();
            } else {
                start = new Date(`${startDate}T04:30:00Z`);
            }

            const end = new Date(`${endDate}T15:30:00Z`);

            if (start < now) {
                const timeMsg = startDate === today
                    ? 'current time'
                    : `${startDate} 10:00 AM IST`;
                onError(`Start time (${timeMsg}) has already passed. Please select a future date or time.`);
                setLoading(false);
                return;
            }

            if (end < now) {
                onError(`End time (${endDate} 9:00 PM IST) has already passed. Please select a future date.`);
                setLoading(false);
                return;
            }

            if (start >= end) {
                onError('End date must be after start date');
                setLoading(false);
                return;
            }

            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });
            setAuthToken(response.accessToken);

            const validAttendees = attendees.filter(email => email.trim());

            let apiStartTime: string;
            if (startDate === today) {
                apiStartTime = now.toISOString();
            } else {
                apiStartTime = `${startDate}T04:30:00Z`;
            }

            const result = await api.suggestMeetings({
                attendees: validAttendees.map(email => ({
                    emailAddress: { address: email.trim() }
                })),
                start: apiStartTime,
                end: `${endDate}T15:30:00Z`,
            });

            onSuggestions(result);
        } catch (err: any) {
            onError(err.message || 'Failed to get suggestions');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
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
        </div>
    );
}
