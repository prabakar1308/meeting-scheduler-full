import React from 'react';
import { useMsal } from '@azure/msal-react';
import { api, setAuthToken } from '../lib/api';
import { loginRequest } from '../lib/msalConfig';

interface ParsedDetails {
    subject: string;
    attendees: string[];
    startTime: string;
    endTime: string;
    duration?: number;
    confidence: number;
    parsedFrom: string;
    internalAttendees: string[];
    externalAttendees: string[];
    availabilityStatus: { [email: string]: 'free' | 'busy' };
    isSlotBusy: boolean;
    hasExternalAttendees: boolean;
}

interface SimpleModeProps {
    onError: (error: string) => void;
    onSuccess: () => void;
}

export default function SimpleMode({ onError, onSuccess }: SimpleModeProps) {
    const { instance, accounts } = useMsal();
    const [naturalInput, setNaturalInput] = React.useState('');
    const [parsedDetails, setParsedDetails] = React.useState<ParsedDetails | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [showConfirmation, setShowConfirmation] = React.useState(false);

    const handleParse = async () => {
        setLoading(true);
        onError('');

        try {
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });
            setAuthToken(response.accessToken);

            const parsed = await api.parseNaturalLanguage(naturalInput);
            setParsedDetails(parsed);
            setShowConfirmation(true);
        } catch (err: any) {
            onError(err.message || 'Failed to parse meeting details');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSchedule = async () => {
        if (!parsedDetails) return;

        setLoading(true);
        onError('');

        try {
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            });

            const organizerEmail = accounts[0]?.username || accounts[0]?.name;

            console.log('🔐 Frontend: Acquired access token');
            console.log('👤 Frontend: User account:', accounts[0]?.username);
            console.log('📧 Frontend: Organizer email:', organizerEmail);

            setAuthToken(response.accessToken);

            console.log('📤 Frontend: Scheduling meeting with subject:', parsedDetails.subject);

            await api.scheduleMeeting({
                subject: parsedDetails.subject,
                organizer: organizerEmail,
                attendees: parsedDetails.attendees.map((email: string) => ({
                    emailAddress: { address: email }
                })),
                start: parsedDetails.startTime,
                end: parsedDetails.endTime,
                createIfFree: false,
            });

            alert(`✅ Meeting "${parsedDetails.subject}" scheduled successfully!\n\nAttendees: ${parsedDetails.attendees.join(', ')}\nTime: ${new Date(parsedDetails.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

            setNaturalInput('');
            setParsedDetails(null);
            setShowConfirmation(false);
            onSuccess();
        } catch (err: any) {
            console.error('❌ Frontend: Error scheduling meeting:', err);
            onError(err.message || 'Failed to schedule meeting');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = () => {
        setShowConfirmation(false);
        setParsedDetails(null);
    };

    return (
        <div>
            <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1rem' }}>
                💡 Describe your meeting in plain English. Example: "Schedule a team sync-up meeting today at 2 PM for 1 hour with john@example.com"
            </div>

            <textarea
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                placeholder="Schedule a team sync-up meeting today at 2 PM for 1 hour with prabakaran.arumugam@hcltech.com"
                disabled={showConfirmation}
                style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '1rem',
                    opacity: showConfirmation ? 0.6 : 1
                }}
            />

            {!showConfirmation ? (
                <button
                    onClick={handleParse}
                    disabled={loading || !naturalInput.trim()}
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
                    {loading ? '⏳ Parsing...' : '🔍 Parse Meeting Details'}
                </button>
            ) : parsedDetails && (
                <div>
                    <div style={{
                        background: '#f7fafc',
                        border: '2px solid #667eea',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem'
                    }}>
                        <h3 style={{ marginTop: 0, color: '#2d3748', fontSize: '1.1rem' }}>📋 Meeting Details</h3>
                        <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                            <p><strong>Subject:</strong> {parsedDetails.subject}</p>
                            <p><strong>Time:</strong> {new Date(parsedDetails.startTime).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'medium',
                                timeStyle: 'short'
                            })} - {new Date(parsedDetails.endTime).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                timeStyle: 'short'
                            })}</p>
                            {parsedDetails.duration && <p><strong>Duration:</strong> {parsedDetails.duration} minutes</p>}
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ margin: '0.5rem 0', color: '#2d3748', fontSize: '1rem' }}>👥 Attendees</h4>

                            {parsedDetails.internalAttendees.length > 0 && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '0.25rem' }}>
                                        Internal Users:
                                    </div>
                                    {parsedDetails.internalAttendees.map((email) => (
                                        <div key={email} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem',
                                            background: 'white',
                                            borderRadius: '4px',
                                            marginBottom: '0.25rem',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            <span style={{ flex: 1, fontSize: '0.85rem' }}>{email}</span>
                                            {parsedDetails.availabilityStatus[email] && (
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontWeight: 'bold',
                                                    background: parsedDetails.availabilityStatus[email] === 'free' ? '#c6f6d5' : '#fed7d7',
                                                    color: parsedDetails.availabilityStatus[email] === 'free' ? '#22543d' : '#742a2a'
                                                }}>
                                                    {parsedDetails.availabilityStatus[email] === 'free' ? '✓ Free' : '✗ Busy'}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {parsedDetails.externalAttendees.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '0.25rem' }}>
                                        External Users:
                                    </div>
                                    {parsedDetails.externalAttendees.map((email) => (
                                        <div key={email} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem',
                                            background: '#fffaf0',
                                            borderRadius: '4px',
                                            marginBottom: '0.25rem',
                                            border: '2px solid #f6ad55'
                                        }}>
                                            <span style={{ flex: 1, fontSize: '0.85rem' }}>{email}</span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontWeight: 'bold',
                                                background: '#feebc8',
                                                color: '#dd6b20'
                                            }}>
                                                🌐 External
                                            </span>
                                        </div>
                                    ))}
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: '#744210',
                                        background: '#feebc8',
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        marginTop: '0.5rem'
                                    }}>
                                        ℹ️ Availability not checked for external users
                                    </div>
                                </div>
                            )}
                        </div>

                        {parsedDetails.isSlotBusy && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                background: '#fff5f5',
                                border: '2px solid #fc8181',
                                borderRadius: '6px',
                                color: '#742a2a',
                                fontSize: '0.875rem',
                                fontWeight: 'bold'
                            }}>
                                ⚠️ Warning: Some internal attendees are busy during this time slot
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={handleEdit}
                            disabled={loading}
                            style={{
                                flex: 1,
                                background: '#e2e8f0',
                                color: '#4a5568',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            ← Edit
                        </button>
                        <button
                            onClick={handleSchedule}
                            disabled={loading}
                            style={{
                                flex: 2,
                                background: loading ? '#a0aec0' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            {loading ? '⏳ Scheduling...' : '✓ Confirm & Schedule'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
