import { Body, Controller, Post, UseGuards, Request, Logger, Headers } from '@nestjs/common';
import { McpAgentService } from './mcp-agent.service';
import { OptionalAzureADGuard } from '../auth/optional-azure-ad.guard';

@Controller('agent-chat')
export class McpAgentController {
    private readonly logger = new Logger(McpAgentController.name);

    constructor(private readonly agentService: McpAgentService) { }

    @Post('message')
    @UseGuards(OptionalAzureADGuard)
    async chat(
        @Body() body: { sessionId: string; message: string },
        @Request() req: any,
        @Headers('authorization') authHeader?: string
    ) {
        // Extract user email (same logic as chat controller)
        let userEmail = req.user?.email ||
            req.user?.preferred_username ||
            req.user?.upn ||
            req.user?.unique_name;

        // Fallback: decode JWT manually
        if (!userEmail && authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                const base64Payload = token.split('.')[1];
                const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

                userEmail = payload.email ||
                    payload.preferred_username ||
                    payload.upn ||
                    payload.unique_name;

                this.logger.log(`Extracted email from JWT: ${userEmail}`);
            } catch (error) {
                this.logger.error('Failed to decode JWT:', error);
            }
        }

        if (!userEmail) {
            return {
                response: 'Please sign in to use the AI agent.',
                error: 'NO_USER_EMAIL'
            };
        }

        const response = await this.agentService.chat(
            body.sessionId,
            body.message,
            userEmail
        );

        return { response };
    }
}
