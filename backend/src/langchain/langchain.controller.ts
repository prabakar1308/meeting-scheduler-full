import { Body, Controller, Post, UseGuards, Request, Logger, Headers } from '@nestjs/common';
import { ConversationalService } from './conversational.service';
import { OptionalAzureADGuard } from '../auth/optional-azure-ad.guard';

@Controller('chat')
export class LangchainController {
    private readonly logger = new Logger(LangchainController.name);

    constructor(private readonly conversationalService: ConversationalService) { }

    @Post('message')
    @UseGuards(OptionalAzureADGuard)
    async processMessage(
        @Body() body: { sessionId: string; message: string },
        @Request() req: any,
        @Headers('authorization') authHeader?: string
    ) {
        // Log the entire user object to see what's available
        this.logger.log('Request user object:', JSON.stringify(req.user, null, 2));

        // Try to extract email from various possible fields
        let userEmail = req.user?.email ||
            req.user?.preferred_username ||
            req.user?.upn ||
            req.user?.unique_name;

        // If Azure AD validation failed but we have a token, decode it manually
        if (!userEmail && authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                // Decode JWT without verification (just parse the payload)
                const base64Payload = token.split('.')[1];
                const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

                userEmail = payload.email ||
                    payload.preferred_username ||
                    payload.upn ||
                    payload.unique_name;

                this.logger.log(`Extracted email from JWT payload: ${userEmail}`);
            } catch (error) {
                this.logger.error('Failed to decode JWT:', error);
            }
        }

        this.logger.log(`Final user email: ${userEmail}`);

        return this.conversationalService.processMessage(body.sessionId, body.message, userEmail);
    }
}
