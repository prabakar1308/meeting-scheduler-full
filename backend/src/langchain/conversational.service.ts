import { ChatOpenAI } from "@langchain/openai";
import { IntentClassification, IntentParser } from "./parsers/intent.parser";
import { MeetingData, MeetingParser } from "./parsers/meeting.parser";

import { Injectable, Logger } from "@nestjs/common";

export interface ConversationSession {
    sessionId: string;

    context: {
        lastIntent?: IntentClassification;
        partialMeetingData?: Partial<MeetingData>;
        conversationHistory: string[];
    };
}

@Injectable()
export class ConversationalService {
    private readonly logger = new Logger(ConversationalService.name);
    private sessions: Map<string, ConversationSession> = new Map();
    private intentParser: IntentParser;
    private meetingParser: MeetingParser;
    private model: ChatOpenAI;

    constructor() {
        this.intentParser = new IntentParser();
        this.meetingParser = new MeetingParser();
        this.model = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0.7,
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Get or create a conversation session
     */
    private getSession(sessionId: string): ConversationSession {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                sessionId,

                context: {
                    conversationHistory: [],
                },
            });
        }
        return this.sessions.get(sessionId)!;
    }

    /**
     * Process user input and return appropriate response
     */
    async processMessage(sessionId: string, userMessage: string): Promise<{
        response: string;
        intent: IntentClassification;
        meetingData?: MeetingData;
        isComplete: boolean;
        requiresScheduling: boolean;
    }> {
        const session = this.getSession(sessionId);

        // Add user message to history
        session.context.conversationHistory.push(`User: ${userMessage}`);


        // Classify intent
        const intent = await this.intentParser.classifyIntent(
            userMessage,
            session.context.conversationHistory
        );
        session.context.lastIntent = intent;

        this.logger.log(`Intent classified: ${intent.intent} (confidence: ${intent.confidence})`);

        let response: string;
        let meetingData: MeetingData | undefined;
        let isComplete = false;
        let requiresScheduling = false;

        switch (intent.intent) {
            case 'schedule_new':
                // Extract meeting data
                meetingData = await this.meetingParser.extractMeetingData(
                    userMessage,
                    session.context.conversationHistory
                );

                // Merge with any partial data from previous messages
                if (session.context.partialMeetingData) {
                    meetingData = this.mergeMeetingData(session.context.partialMeetingData, meetingData);
                }

                session.context.partialMeetingData = meetingData;

                if (meetingData.isComplete) {
                    isComplete = true;
                    requiresScheduling = true;
                    response = `Great! I'll schedule a meeting with the following details:\n` +
                        `- Subject: ${meetingData.subject || 'Meeting'}\n` +
                        `- Attendees: ${meetingData.attendees?.join(', ')}\n` +
                        `- Time: ${this.formatTime(meetingData.startTime!)}\n` +
                        `- Duration: ${meetingData.duration} minutes\n\n` +
                        `Let me check availability...`;
                } else {
                    // Ask for missing information
                    response = await this.meetingParser.generateClarifyingQuestions(meetingData.missingFields);
                }
                break;

            case 'clarify':
                // User is providing additional information
                meetingData = await this.meetingParser.extractMeetingData(
                    userMessage,
                    session.context.conversationHistory
                );

                // Merge with existing partial data
                if (session.context.partialMeetingData) {
                    meetingData = this.mergeMeetingData(session.context.partialMeetingData, meetingData);
                }

                session.context.partialMeetingData = meetingData;

                if (meetingData.isComplete) {
                    isComplete = true;
                    requiresScheduling = true;
                    response = `Perfect! I have all the information I need. Let me check availability and schedule the meeting.`;
                } else {
                    response = await this.meetingParser.generateClarifyingQuestions(meetingData.missingFields);
                }
                break;

            case 'modify_existing':
                response = `I'll help you modify the meeting. What would you like to change?`;
                // TODO: Implement modification logic
                break;

            case 'ask_question':
                response = await this.generateQuestionResponse(userMessage, session);
                break;

            case 'cancel':
                this.clearSession(sessionId);
                response = `Okay, I've cancelled the scheduling process. Let me know if you need anything else!`;
                break;

            default:
                response = `I'm not sure I understand. Could you please clarify what you'd like to do?`;
        }

        // Add assistant response to history
        session.context.conversationHistory.push(`Assistant: ${response}`);


        return {
            response,
            intent,
            meetingData,
            isComplete,
            requiresScheduling,
        };
    }

    /**
     * Merge partial meeting data from multiple messages
     */
    private mergeMeetingData(existing: Partial<MeetingData>, newData: MeetingData): MeetingData {
        return {
            ...existing,
            ...newData,
            subject: newData.subject || existing.subject,
            attendees: newData.attendees || existing.attendees,
            startTime: newData.startTime || existing.startTime,
            endTime: newData.endTime || existing.endTime,
            duration: newData.duration || existing.duration,
        } as MeetingData;
    }

    /**
     * Generate response to user questions
     */
    private async generateQuestionResponse(question: string, session: ConversationSession): Promise<string> {
        const prompt = `You are a helpful meeting scheduling assistant. Answer the following question about meeting scheduling:

Question: ${question}

Context from conversation:
${session.context.conversationHistory.slice(-5).join('\n')}

Provide a helpful, concise answer.`;

        const response = await this.model.invoke(prompt);
        return response.content as string;
    }

    /**
     * Format time for display
     */
    private formatTime(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }

    /**
     * Clear a conversation session
     */
    clearSession(sessionId: string): void {
        this.sessions.delete(sessionId);
        this.logger.log(`Cleared session: ${sessionId}`);
    }

    /**
     * Get current session context (for debugging)
     */
    getSessionContext(sessionId: string): ConversationSession | undefined {
        return this.sessions.get(sessionId);
    }
}
