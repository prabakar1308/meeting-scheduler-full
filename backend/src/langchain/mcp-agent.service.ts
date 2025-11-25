import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { McpService } from '../mcp/mcp.service';
import { McpToolAdapter } from './tools/mcp-tool-adapter';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { LLMProvider } from './providers/llm.provider';

interface AgentSession {
    sessionId: string;
    conversationHistory: Array<{ role: string; content: string }>;
    lastActivity: Date;
}

@Injectable()
export class McpAgentService {
    private readonly logger = new Logger(McpAgentService.name);
    private sessions: Map<string, AgentSession> = new Map();

    constructor(private mcpService: McpService) { }

    /**
     * Get or create session
     */
    private getSession(sessionId: string): AgentSession {
        let session = this.sessions.get(sessionId);

        if (!session) {
            session = {
                sessionId,
                conversationHistory: [],
                lastActivity: new Date(),
            };
            this.sessions.set(sessionId, session);
            this.logger.log(`Created new agent session: ${sessionId}`);
        }

        session.lastActivity = new Date();
        return session;
    }

    /**
     * Chat with the agent using MCP tools
     * This is a simplified implementation that manually handles tool calling
     */
    async chat(sessionId: string, userMessage: string, userEmail: string): Promise<string> {
        try {
            this.logger.log(`[Agent Chat] Session: ${sessionId}, User: ${userEmail}`);
            this.logger.log(`[Agent Chat] Message: ${userMessage}`);

            const session = this.getSession(sessionId);
            session.conversationHistory.push({ role: 'user', content: userMessage });

            // Create LLM using multi-modal provider
            const model = LLMProvider.createChatModel({
                task: 'agent',
                temperature: 0
            });

            // Get MCP tools
            const tools = McpToolAdapter.createLangChainTools(this.mcpService);

            // Create system message with tool descriptions
            const toolDescriptions = tools.map(tool =>
                `- ${tool.name}: ${tool.description}`
            ).join('\\n');

            const systemMessage = `You are a helpful meeting scheduling assistant with access to the following tools:

${toolDescriptions}

The user's email is: ${userEmail}

When scheduling meetings:
1. ALWAYS use suggest_meeting_times FIRST to check availability
2. Present the available times to the user
3. Wait for user confirmation before scheduling
4. Use schedule_meeting ONLY after the user confirms a time slot

Important guidelines:
- Always use the user's email (${userEmail}) as the organizer
- Convert times to UTC format (ISO 8601) when calling tools
- Be conversational and helpful
- Explain what you're doing
- If a time slot is busy, suggest alternatives

Current date and time: ${new Date().toISOString()}

To use a tool, respond with JSON in this format:
{
  "action": "tool_name",
  "args": { ...tool arguments... }
}

If you don't need to use a tool, just respond normally.`;

            // Build conversation context
            const messages = [
                { role: 'system', content: systemMessage },
                ...session.conversationHistory.slice(-10), // Last 10 messages
            ];

            // Get LLM response
            const response = await model.invoke(messages.map(m => [m.role, m.content]));
            let responseText = response.content as string;

            this.logger.log(`[Agent] Initial response: ${responseText}`);

            // Check if LLM wants to use a tool
            if (responseText.includes('"action"') && responseText.includes('"args"')) {
                try {
                    // Extract JSON from response
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const toolCall = JSON.parse(jsonMatch[0]);
                        const tool = tools.find(t => t.name === toolCall.action);

                        if (tool) {
                            this.logger.log(`[Agent] Calling tool: ${toolCall.action}`);
                            this.logger.log(`[Agent] Tool args:`, toolCall.args);

                            // Execute tool
                            const toolResult = await tool.func(toolCall.args);
                            this.logger.log(`[Agent] Tool result:`, toolResult);

                            // Get final response from LLM with tool result
                            const finalMessages = [
                                ...messages,
                                { role: 'assistant', content: responseText },
                                { role: 'system', content: `Tool ${toolCall.action} returned: ${toolResult}\\n\\nPlease provide a natural language response to the user based on this result.` },
                            ];

                            const finalResponse = await model.invoke(finalMessages.map(m => [m.role, m.content]));
                            responseText = finalResponse.content as string;
                        }
                    }
                } catch (error) {
                    this.logger.error(`[Agent] Tool execution error:`, error);
                    responseText = `I tried to use a tool but encountered an error. Let me try to help you differently.`;
                }
            }

            session.conversationHistory.push({ role: 'assistant', content: responseText });

            this.logger.log(`[Agent Chat] Final response: ${responseText}`);

            return responseText;
        } catch (error: any) {
            this.logger.error(`[Agent Chat] Error:`, error);
            return `I encountered an error: ${error.message}. Please try rephrasing your request.`;
        }
    }

    /**
     * Clear a session
     */
    clearSession(sessionId: string): void {
        this.sessions.delete(sessionId);
        this.logger.log(`Cleared agent session: ${sessionId}`);
    }
}
