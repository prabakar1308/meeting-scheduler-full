import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { McpService } from '../../mcp/mcp.service';
import { Logger } from '@nestjs/common';

/**
 * Adapter to convert MCP tools into LangChain DynamicStructuredTools
 * This allows LangChain agents to use MCP-registered tools
 */
export class McpToolAdapter {
    private static readonly logger = new Logger(McpToolAdapter.name);

    /**
     * Create LangChain tools from MCP service
     */
    static createLangChainTools(mcpService: McpService): DynamicStructuredTool[] {
        return [
            this.createSuggestMeetingTimesTool(mcpService),
            this.createScheduleMeetingTool(mcpService),
            this.createGetMeetingsTool(mcpService),
        ];
    }

    /**
     * Tool: Suggest meeting times based on availability
     */
    private static createSuggestMeetingTimesTool(mcpService: McpService): DynamicStructuredTool {
        return new DynamicStructuredTool({
            name: 'suggest_meeting_times',
            description: `Find available meeting times for attendees within a time window.
                Use this tool to check availability before scheduling.
                Returns a list of available time slots ranked by preference.`,
            schema: z.object({
                organizer: z.string().email().describe('Email address of the meeting organizer'),
                attendees: z.array(z.string().email()).describe('Array of attendee email addresses'),
                start: z.string().describe('Start of the time window (ISO 8601 datetime in UTC)'),
                end: z.string().describe('End of the time window (ISO 8601 datetime in UTC)'),
            }),
            func: async (input) => {
                try {
                    this.logger.log(`[suggest_meeting_times] Called with:`, JSON.stringify(input, null, 2));

                    // Normalize parameter names (LLM might use start_time/end_time instead of start/end)
                    const normalizedInput = {
                        organizer: input.organizer,
                        attendees: input.attendees,
                        start: input.start || input.start_time,
                        end: input.end || input.end_time
                    };

                    // Validate required parameters
                    if (!normalizedInput.organizer) {
                        throw new Error('Missing required parameter: organizer');
                    }
                    if (!normalizedInput.attendees || !Array.isArray(normalizedInput.attendees) || normalizedInput.attendees.length === 0) {
                        throw new Error('Missing required parameter: attendees (must be a non-empty array)');
                    }
                    if (!normalizedInput.start) {
                        throw new Error('Missing required parameter: start (or start_time)');
                    }
                    if (!normalizedInput.end) {
                        throw new Error('Missing required parameter: end (or end_time)');
                    }

                    this.logger.log(`[suggest_meeting_times] Validation passed. Executing tool...`);

                    const result = await mcpService.executeTool('suggest_meeting_times', normalizedInput);

                    this.logger.log(`[suggest_meeting_times] Result:`, JSON.stringify(result, null, 2));

                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    this.logger.error(`[suggest_meeting_times] Error:`, error);
                    this.logger.error(`[suggest_meeting_times] Error stack:`, error.stack);
                    this.logger.error(`[suggest_meeting_times] Input was:`, JSON.stringify(input, null, 2));
                    return JSON.stringify({
                        error: error.message,
                        suggestion: 'Please check the input parameters and try again. Make sure all email addresses are valid and times are in ISO 8601 format.',
                        receivedInput: input
                    });
                }
            },
        });
    }

    /**
     * Tool: Schedule a meeting
     */
    private static createScheduleMeetingTool(mcpService: McpService): DynamicStructuredTool {
        return new DynamicStructuredTool({
            name: 'schedule_meeting',
            description: `Schedule a meeting at a specific time.
                Use this tool ONLY after confirming availability with suggest_meeting_times.
                Creates the meeting and sends invitations to all attendees.`,
            schema: z.object({
                organizer: z.string().email().describe('Email address of the meeting organizer'),
                attendees: z.array(z.string().email()).describe('Array of attendee email addresses'),
                start: z.string().describe('Meeting start time (ISO 8601 datetime in UTC)'),
                end: z.string().describe('Meeting end time (ISO 8601 datetime in UTC)'),
                subject: z.string().optional().describe('Meeting subject/title'),
            }),
            func: async (input) => {
                try {
                    this.logger.log(`[schedule_meeting] Called with:`, JSON.stringify(input, null, 2));

                    // Normalize parameter names (LLM might use start_time/end_time instead of start/end)
                    const normalizedInput = {
                        organizer: input.organizer,
                        attendees: input.attendees,
                        start: input.start || input.start_time,
                        end: input.end || input.end_time,
                        subject: input.subject
                    };

                    // Validate required parameters
                    if (!normalizedInput.organizer) {
                        throw new Error('Missing required parameter: organizer');
                    }
                    if (!normalizedInput.attendees || !Array.isArray(normalizedInput.attendees) || normalizedInput.attendees.length === 0) {
                        throw new Error('Missing required parameter: attendees (must be a non-empty array)');
                    }
                    if (!normalizedInput.start) {
                        throw new Error('Missing required parameter: start (or start_time)');
                    }
                    if (!normalizedInput.end) {
                        throw new Error('Missing required parameter: end (or end_time)');
                    }

                    this.logger.log(`[schedule_meeting] Validation passed. Creating meeting...`);

                    const result = await mcpService.executeTool('schedule_meeting', normalizedInput);

                    this.logger.log(`[schedule_meeting] Result:`, JSON.stringify(result, null, 2));

                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    this.logger.error(`[schedule_meeting] Error:`, error);
                    this.logger.error(`[schedule_meeting] Error stack:`, error.stack);
                    this.logger.error(`[schedule_meeting] Input was:`, JSON.stringify(input, null, 2));

                    // Check if it's a Graph API error
                    if (error.response?.data?.error) {
                        this.logger.error(`[schedule_meeting] Graph API error:`, JSON.stringify(error.response.data.error, null, 2));
                    }

                    return JSON.stringify({
                        error: error.message,
                        suggestion: 'The meeting could not be scheduled. Please verify the time slot is still available and all parameters are correct.',
                        receivedInput: input
                    });
                }
            },
        });
    }


    /**
     * Tool: Get meetings for a user
     */
    private static createGetMeetingsTool(mcpService: McpService): DynamicStructuredTool {
        return new DynamicStructuredTool({
            name: 'get_meetings',
            description: `Retrieve calendar events/meetings for a user within a date range.
                Use this tool to answer questions about existing meetings, such as:
                - "What meetings do I have tomorrow?" - use the authenticated user's email
                - "Show me my meetings this week" - use the authenticated user's email
                - "List all meetings for user@example.com" - use the specified email
                
                IMPORTANT: When user asks about "my meetings" or "I", use their email address from the system context.`,
            schema: z.object({
                user_email: z.string().email().describe('Email address of the user whose meetings to retrieve. Use the authenticated user email from system context when user asks about "my meetings".'),
                start_date: z.string().optional().describe('Start date/time (ISO 8601 datetime in UTC). Defaults to today'),
                end_date: z.string().optional().describe('End date/time (ISO 8601 datetime in UTC). Defaults to 7 days from start'),
            }),
            func: async (input) => {
                try {
                    this.logger.log(`[get_meetings] Called with:`, JSON.stringify(input, null, 2));

                    // Validate required parameters
                    if (!input.user_email) {
                        throw new Error('Missing required parameter: user_email');
                    }

                    this.logger.log(`[get_meetings] Validation passed. Fetching meetings...`);

                    const result = await mcpService.executeTool('get_meetings', input);

                    this.logger.log(`[get_meetings] Found ${result?.length || 0} meetings`);

                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    this.logger.error(`[get_meetings] Error:`, error);
                    this.logger.error(`[get_meetings] Error stack:`, error.stack);
                    this.logger.error(`[get_meetings] Input was:`, JSON.stringify(input, null, 2));
                    return JSON.stringify({
                        error: error.message,
                        suggestion: 'Please check the user email and date range parameters.',
                        receivedInput: input
                    });
                }
            },
        });
    }
}

