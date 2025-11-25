import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ConversationalService } from './conversational.service';
import { OptionalAzureADGuard } from '../auth/optional-azure-ad.guard';

@Controller('chat')
export class LangchainController {
    constructor(private readonly conversationalService: ConversationalService) { }

    @Post('message')
    @UseGuards(OptionalAzureADGuard)
    async processMessage(@Body() body: { sessionId: string; message: string }, @Request() req: any) {
        const userEmail = req.user?.email;
        return this.conversationalService.processMessage(body.sessionId, body.message, userEmail);
    }
}
