import React, { useState, useEffect, useRef } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function Chat() {
    const isAuthenticated = useIsAuthenticated();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => `session-${Date.now()}`);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isAuthenticated) {
            // Add welcome message
            setMessages([{
                role: 'assistant',
                content: 'Hi! I\'m your meeting scheduling assistant. You can tell me things like:\n\n• "Schedule a meeting with john@example.com tomorrow at 10am for 30 minutes"\n• "Book a call with sarah@example.com next Monday at 2pm"\n• "Set up a meeting with the team on Friday at 3pm"\n\nHow can I help you today?',
                timestamp: new Date()
            }]);
        }
    }, [isAuthenticated]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.sendChatMessage(sessionId, input);

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isAuthenticated) {
        return (
            <Layout>
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#2d3748' }}>
                        Authentication Required
                    </h1>
                    <p style={{ color: '#718096' }}>
                        Please sign in to use the chat assistant
                    </p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div style={{
                maxWidth: '900px',
                margin: '0 auto',
                height: 'calc(100vh - 200px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                        💬 Chat Assistant
                    </h1>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
                        Schedule meetings naturally with conversation
                    </p>
                </div>

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.5rem',
                    background: '#f7fafc'
                }}>
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: '1rem'
                            }}
                        >
                            <div style={{
                                maxWidth: '70%',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                background: message.role === 'user'
                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    : 'white',
                                color: message.role === 'user' ? 'white' : '#2d3748',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {message.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                background: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: '#667eea',
                                        animation: 'bounce 1.4s infinite ease-in-out both'
                                    }} />
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: '#667eea',
                                        animation: 'bounce 1.4s infinite ease-in-out both 0.2s'
                                    }} />
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: '#667eea',
                                        animation: 'bounce 1.4s infinite ease-in-out both 0.4s'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: '1rem',
                    borderTop: '1px solid #e2e8f0',
                    background: 'white'
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message... (e.g., 'Schedule a meeting with john@example.com tomorrow at 10am')"
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: '0.75rem 1rem',
                                border: '2px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#667eea'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: input.trim() && !isLoading
                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    : '#cbd5e0',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                boxShadow: input.trim() && !isLoading ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes bounce {
                    0%, 80%, 100% {
                        transform: scale(0);
                    }
                    40% {
                        transform: scale(1);
                    }
                }
            `}</style>
        </Layout>
    );
}
