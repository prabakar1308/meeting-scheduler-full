import { ActivityHandler, MessageFactory, TurnContext } from 'botbuilder';
import { Injectable, Logger } from '@nestjs/common';
import { McpAgentService } from '../langchain/mcp-agent.service';

@Injectable()
export class TeamsBot extends ActivityHandler {
    private readonly logger = new Logger(TeamsBot.name);

    constructor(private mcpAgentService: McpAgentService) {
        super();

        this.onMessage(async (context, next) => {
            this.logger.log(`Incoming message from ${context.activity.from.name}: ${context.activity.text}`);

            const text = context.activity.text;
            const sessionId = context.activity.conversation.id;

            // Try to get email from various properties, fallback to a placeholder if not found
            // In a real Teams app with SSO, we would get the token and fetch the profile
            const userEmail = context.activity.from.properties?.email ||
                (context.activity.from.id.includes('@') ? context.activity.from.id : 'valarmathi.jm@6tjp7n.onmicrosoft.com');

            try {
                // Send "typing" indicator
                await context.sendActivity({ type: 'typing' });

                // Call the Agent
                const response = await this.mcpAgentService.chat(sessionId, text, userEmail);

                // Send response back to Teams
                await context.sendActivity(MessageFactory.text(response, response));
            } catch (error) {
                this.logger.error('Error handling message:', error);
                await context.sendActivity('Sorry, I encountered an error processing your request.');
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Hello and welcome! I am your Meeting Scheduler Agent. You can ask me to check your calendar or schedule meetings.';
            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}
