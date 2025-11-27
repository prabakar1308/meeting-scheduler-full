import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
// Import Zod v3 from the SDK's bundled version to ensure compatibility
import * as z3 from 'zod/v3';
import { SchedulingService } from '../scheduling/scheduling.service';
import { Request, Response } from 'express';

@Injectable()
export class McpService implements OnModuleInit {
    private server: McpServer;
    private transport: SSEServerTransport | null = null;
    private toolHandlers: Map<string, (args: any) => Promise<any>> = new Map();

    constructor(private schedulingService: SchedulingService) {
        this.server = new McpServer({
            name: 'Meeting Scheduler MCP',
            version: '1.0.0',
        });
    }

    onModuleInit() {
        this.registerTools();
    }

    private registerTools() {
        // Define schemas using Zod v3 (bundled with the SDK) for compatibility
        const meetingParamsSchema = z3.object({
            organizer: z3.string().email().describe('Email address of the meeting organizer'),
            attendees: z3.array(z3.string().email()).describe('Array of attendee email addresses'),
            start: z3.string().datetime().describe('Start of the time window (ISO 8601 datetime)'),
            end: z3.string().datetime().describe('End of the time window (ISO 8601 datetime)'),
        });

        const suggestHandler = async (args: any) => {
            const result = await this.schedulingService.suggestSlots(args);
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        };

        const scheduleHandler = async (args: any) => {
            const result = await this.schedulingService.scheduleMeeting(args);
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        };

        this.server.registerTool(
            'suggest_meeting_times',
            {
                description: 'Suggest meeting times based on availability. Business Hours: 10:00 AM - 9:00 PM IST (04:30 UTC - 15:30 UTC). Please convert all times to UTC within this range before calling.',
                inputSchema: meetingParamsSchema as any,
            },
            suggestHandler,
        );
        this.toolHandlers.set('suggest_meeting_times', suggestHandler);

        this.server.registerTool(
            'schedule_meeting',
            {
                description: 'Schedule a meeting with the best available slot. Business Hours: 10:00 AM - 9:00 PM IST (04:30 UTC - 15:30 UTC). Please convert all times to UTC within this range before calling.',
                inputSchema: meetingParamsSchema as any,
            },
            scheduleHandler,
        );
        this.toolHandlers.set('schedule_meeting', scheduleHandler);


        // Get meetings tool
        const getMeetingsSchema = z3.object({
            user_email: z3.string().email().describe('Email address of the user whose meetings to retrieve'),
            start_date: z3.string().datetime().optional().describe('Start date/time (ISO 8601). Defaults to today'),
            end_date: z3.string().datetime().optional().describe('End date/time (ISO 8601). Defaults to 7 days from start'),
        });

        const getMeetingsHandler = async (args: any) => {
            // Default to today if no start date provided
            const startDate = args.start_date || new Date().toISOString();

            // Default to 7 days from start if no end date provided
            const endDate = args.end_date || new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

            console.log(`[get_meetings] Received args:`, args);
            console.log(`[get_meetings] Using dates - Start: ${startDate}, End: ${endDate}`);

            // Call Graph API via SchedulingService's graph client
            const result = await this.schedulingService['graph'].getEvents(
                args.user_email,
                startDate,
                endDate
            );

            console.log(`[get_meetings] Found ${result?.length || 0} events`);

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        };

        this.server.registerTool(
            'get_meetings',
            {
                description: 'Retrieve calendar events/meetings for a user within a date range. Use this to answer questions about existing meetings.',
                inputSchema: getMeetingsSchema as any,
            },
            getMeetingsHandler,
        );
        this.toolHandlers.set('get_meetings', getMeetingsHandler);

        // Search users tool
        const searchUsersSchema = z3.object({
            query: z3.string().describe('Name or email to search for'),
        });

        const searchUsersHandler = async (args: any) => {
            const result = await this.schedulingService.searchUsers(args.query);
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        };

        this.server.registerTool(
            'search_users',
            {
                description: 'Search for internal users by name or email. Use this to find email addresses when user provides names.',
                inputSchema: searchUsersSchema as any,
            },
            searchUsersHandler,
        );
        this.toolHandlers.set('search_users', searchUsersHandler);
    }

    async handleSSE(req: Request, res: Response) {
        this.transport = new SSEServerTransport('/mcp/messages', res);
        await this.server.connect(this.transport);
    }

    async handleMessage(req: Request, res: Response) {
        if (!this.transport) {
            res.status(400).send('No active SSE connection');
            return;
        }
        // Pass the parsed body to the transport, as NestJS has already consumed the stream
        await this.transport.handlePostMessage(req, res, req.body);
    }

    /**
     * Execute an MCP tool programmatically (for LangChain integration)
     */
    async executeTool(toolName: string, args: any): Promise<any> {
        const handler = this.toolHandlers.get(toolName);

        if (!handler) {
            throw new Error(`Tool not found: ${toolName}`);
        }

        // Execute the tool handler
        const result = await handler(args);

        // Extract text content from MCP response format
        if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find((c: any) => c.type === 'text');
            if (textContent) {
                return JSON.parse(textContent.text);
            }
        }

        return result;
    }
}
