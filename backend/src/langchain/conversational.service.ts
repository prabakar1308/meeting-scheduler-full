import { ChatOpenAI } from "@langchain/openai";
import { IntentClassification, IntentParser } from "./parsers/intent.parser";
import { MeetingData, MeetingParser } from "./parsers/meeting.parser";
import { SchedulingService } from "../scheduling/scheduling.service";

import { Injectable, Logger } from "@nestjs/common";

export interface ConversationSession {
    sessionId: string;

    context: {
        lastIntent?: IntentClassification;
        partialMeetingData?: Partial<MeetingData>;
        conversationHistory: string[];
        proposedSlots?: any[];
        pendingBooking?: any;
    };
}

@Injectable()
export class ConversationalService {
    private readonly logger = new Logger(ConversationalService.name);
    private sessions: Map<string, ConversationSession> = new Map();
    private intentParser: IntentParser;
    private meetingParser: MeetingParser;
    private model: ChatOpenAI;

    constructor(private schedulingService: SchedulingService) {
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
    async processMessage(sessionId: string, userMessage: string, userEmail?: string): Promise<{
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
                    // Check availability
                    if (userEmail) {
                        response = await this.checkAndPropose(session, meetingData, userEmail);
                    } else {
                        response = "I can help with that, but I need to know who you are first. (System: User email not provided)";
                    }
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
                    if (userEmail) {
                        response = await this.checkAndPropose(session, meetingData, userEmail);
                    } else {
                        response = "I can help with that, but I need to know who you are first. (System: User email not provided)";
                    }
                } else {
                    response = await this.meetingParser.generateClarifyingQuestions(meetingData.missingFields);
                }
                break;

            case 'confirm':
                if (session.context.pendingBooking) {
                    // Execute booking
                    response = await this.executeBooking(session, session.context.pendingBooking, userEmail);
                    session.context.pendingBooking = undefined;
                    session.context.partialMeetingData = undefined;
                    session.context.proposedSlots = undefined;
                } else {
                    response = "I'm not sure what you're confirming. Could you clarify?";
                }
                break;

            case 'select_slot':
                if (session.context.proposedSlots && session.context.proposedSlots.length > 0) {
                    const slotId = intent.extractedData?.slotId;
                    let selectedSlot;

                    if (slotId) {
                        // Try to parse slot ID as number
                        const rank = parseInt(slotId.replace(/\D/g, ''));
                        if (!isNaN(rank) && rank > 0 && rank <= session.context.proposedSlots.length) {
                            selectedSlot = session.context.proposedSlots[rank - 1];
                        }
                    }

                    if (!selectedSlot) {
                        // Fallback: assume first slot or ask for clarification
                        // For now, let's just pick the first one if the user says "yes" or similar
                        // But "select_slot" usually implies a specific choice.
                        // If we can't determine, ask.
                        response = "Which slot would you like? You can say 'the first one' or 'slot 1'.";
                    } else {
                        // Prepare for booking
                        const meetingDetails = session.context.partialMeetingData!;
                        const bookingPayload = {
                            subject: meetingDetails.subject,
                            attendees: meetingDetails.attendees,
                            start: selectedSlot.start,
                            end: selectedSlot.end,
                            organizer: userEmail
                        };

                        session.context.pendingBooking = bookingPayload;
                        response = `You selected: ${this.formatTime(selectedSlot.start)} to ${this.formatTime(selectedSlot.end)}. Shall I schedule this?`;
                    }
                } else {
                    response = "I don't have any proposed slots to select from. Let's start over.";
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

    private async checkAndPropose(session: ConversationSession, meetingData: MeetingData, organizer: string): Promise<string> {
        const startTime = new Date(meetingData.startTime!);
        const endTime = new Date(meetingData.endTime!);

        const availability = await this.schedulingService.checkAvailability(
            organizer,
            startTime,
            endTime,
            meetingData.attendees!
        );

        if (!availability.isSlotBusy) {
            // Slot is free
            session.context.pendingBooking = {
                subject: meetingData.subject,
                attendees: meetingData.attendees,
                start: meetingData.startTime,
                end: meetingData.endTime,
                organizer: organizer
            };
            return `Good news! The slot ${this.formatTime(meetingData.startTime!)} is available for all attendees. Shall I schedule it?`;
        } else {
            // Slot is busy, propose alternatives
            session.context.proposedSlots = availability.alternativeSlots;

            if (availability.alternativeSlots.length === 0) {
                return `That time is busy, and I couldn't find any immediate alternatives. Could you propose a different time?`;
            }

            let response = `That time doesn't work for everyone. Here are some alternatives:\n`;
            availability.alternativeSlots.forEach((slot: any, index: number) => {
                response += `${index + 1}. ${this.formatTime(slot.start)}\n`;
            });
            response += `\nWhich one would you like?`;
            return response;
        }
    }

    private async executeBooking(session: ConversationSession, bookingData: any, organizer?: string): Promise<string> {
        try {
            await this.schedulingService.scheduleMeeting({
                ...bookingData,
                organizer: organizer || bookingData.organizer
            });
            return `Meeting scheduled successfully! I've sent invites to all attendees.`;
        } catch (error) {
            this.logger.error(`Failed to schedule meeting: ${error}`);
            return `I encountered an error while scheduling the meeting. Please try again later.`;
        }
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
