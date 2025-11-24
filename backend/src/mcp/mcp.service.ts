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

        this.server.registerTool(
            'suggest_meeting_times',
            {
                description: 'Suggest meeting times based on availability',
                inputSchema: meetingParamsSchema as any,
            },
            async (args: any) => {
                const result = await this.schedulingService.suggestSlots(args);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );

        this.server.registerTool(
            'schedule_meeting',
            {
                description: 'Schedule a meeting with the best available slot',
                inputSchema: meetingParamsSchema as any,
            },
            async (args: any) => {
                const result = await this.schedulingService.scheduleMeeting(args);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
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
}
