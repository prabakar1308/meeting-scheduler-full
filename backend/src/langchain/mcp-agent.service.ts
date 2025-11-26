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

            const systemMessage = `You are a helpful AI meeting scheduling assistant with access to calendar tools.

CRITICAL RESPONSE RULES:
1. ALWAYS respond to the user in natural, conversational language
2. NEVER show raw JSON or tool syntax in your response to the user
3. When you need to use a tool, include the JSON internally but ALSO provide a natural explanation

TIMEZONE RULES:
- The user's timezone is IST (India Standard Time, UTC+5:30)
- ALWAYS display times in IST format when presenting information to the user
- When you receive times from tools (which are in UTC), convert them to IST before showing to user
- Format times as: "2:00 PM IST" or "14:00 IST"
- Example: If tool returns "08:30 UTC", display it as "2:00 PM IST" (8:30 + 5:30 = 14:00)

Available tools:
${toolDescriptions}

User's email (use as organizer): ${userEmail}
Current date/time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}

TOOL USAGE INSTRUCTIONS:
- When using get_meetings for "my meetings" or "I", always pass user_email: "${userEmail}"
- When using suggest_meeting_times or schedule_meeting, always pass organizer: "${userEmail}"
- Extract meeting subjects from user requests and include them in schedule_meeting

DATE CALCULATION (IST timezone):
- Current IST time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
- For "tomorrow": Calculate tomorrow's date in IST, then convert start (00:00) and end (23:59) to UTC ISO format
- For "today": Use today's date in IST, convert to UTC ISO format
- Example for tomorrow (Nov 27, 2025):
  start_date: "2025-11-26T18:30:00.000Z" (Nov 27 00:00 IST = Nov 26 18:30 UTC)
  end_date: "2025-11-27T18:29:59.999Z" (Nov 27 23:59 IST = Nov 27 18:29 UTC)


WORKFLOW:
1. Use suggest_meeting_times FIRST to check availability
2. Present available times to the user in a friendly way
3. Wait for user confirmation (e.g., "yes", "schedule it", "confirm")
4. Use schedule_meeting ONLY after explicit confirmation
5. After scheduling, DO NOT schedule again unless user requests a NEW meeting

CONVERSATION AWARENESS:
- If you just scheduled a meeting and user says "thanks" or "great", just acknowledge - DO NOT schedule again
- Only schedule a new meeting if user explicitly requests it with different details
- Check the conversation history to see if a meeting was already scheduled

SUBJECT PARAMETER:
- ALWAYS extract and include the meeting subject/title from the user's request
- If user says "schedule a team sync", subject should be "Team Sync"
- If user says "meeting about project review", subject should be "Project Review"  
- If no subject mentioned, use a descriptive default like "Meeting"
- Include subject in schedule_meeting args: "subject": "Team Sync-up Meeting"

RESPONSE FORMAT:
When using a tool, structure your response like this:

[Natural language explanation for the user]

{
  "action": "tool_name",
  "args": {...}
}

EXAMPLES:

✅ GOOD Response:
"I'll check availability for you and the attendees tomorrow from 2-3 PM IST. Let me find some good time slots for you.

{
  "action": "suggest_meeting_times",
  "args": {...}
}"

❌ BAD Response (don't do this):
{
  "action": "suggest_meeting_times",
  "args": {...}
}

Remember: Always include a friendly explanation BEFORE the tool JSON!`;

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

                        // Extract the natural language explanation (text before JSON)
                        const naturalResponse = responseText.substring(0, jsonMatch.index).trim();

                        if (tool) {
                            this.logger.log(`[Agent] Calling tool: ${toolCall.action}`);
                            this.logger.log(`[Agent] Tool args:`, toolCall.args);
                            this.logger.log(`[Agent] Natural response: ${naturalResponse}`);

                            // Execute tool
                            const toolResult = await tool.func(toolCall.args);
                            this.logger.log(`[Agent] Tool result:`, toolResult);

                            // Get final response from LLM with tool result
                            const finalMessages = [
                                ...messages,
                                { role: 'assistant', content: responseText },
                                { role: 'system', content: `Tool ${toolCall.action} returned: ${toolResult}\n\nPlease provide a natural language response to the user based on this result. DO NOT include JSON in your response.` },
                            ];

                            const finalResponse = await model.invoke(finalMessages.map(m => [m.role, m.content]));
                            responseText = finalResponse.content as string;

                            // Remove any JSON from the final response (just in case)
                            const finalJsonMatch = responseText.match(/\{[\s\S]*\}/);
                            if (finalJsonMatch) {
                                responseText = responseText.substring(0, finalJsonMatch.index).trim();
                            }
                        } else if (naturalResponse) {
                            // Tool not found, but we have a natural response
                            responseText = naturalResponse;
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
