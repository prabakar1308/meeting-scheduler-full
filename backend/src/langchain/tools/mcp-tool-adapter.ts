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
                    this.logger.log(`[suggest_meeting_times] Called with:`, input);

                    const result = await mcpService.executeTool('suggest_meeting_times', input);

                    this.logger.log(`[suggest_meeting_times] Result:`, result);

                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    this.logger.error(`[suggest_meeting_times] Error:`, error);
                    return JSON.stringify({
                        error: error.message,
                        suggestion: 'Please check the input parameters and try again. Make sure all email addresses are valid and times are in ISO 8601 format.',
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
                    this.logger.log(`[schedule_meeting] Called with:`, input);

                    const result = await mcpService.executeTool('schedule_meeting', input);

                    this.logger.log(`[schedule_meeting] Result:`, result);

                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    this.logger.error(`[schedule_meeting] Error:`, error);
                    return JSON.stringify({
                        error: error.message,
                        suggestion: 'The meeting could not be scheduled. Please verify the time slot is still available.',
                    });
                }
            },
        });
    }
}
