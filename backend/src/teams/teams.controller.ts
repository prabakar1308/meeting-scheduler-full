import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { BotFrameworkAdapter } from 'botbuilder';
import { TeamsBot } from './teams.bot';

@Controller('api/messages')
export class TeamsController {
    private adapter: BotFrameworkAdapter;

    constructor(private bot: TeamsBot) {
        this.adapter = new BotFrameworkAdapter({
            appId: process.env.MICROSOFT_APP_ID,
            appPassword: process.env.MICROSOFT_APP_PASSWORD
        });

        this.adapter.onTurnError = async (context, error) => {
            console.error(`\n [onTurnError] unhandled error: ${error}`);
            await context.sendActivity('The bot encountered an error or bug.');
            await context.sendActivity('To continue to run this bot, please fix the bot source code.');
        };
    }

    @Post()
    async messages(@Req() req: Request, @Res() res: Response) {
        await this.adapter.process(req, res, (context) => this.bot.run(context));
    }
}
