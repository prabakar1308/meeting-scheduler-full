# MCP + LangChain Integration Guide

## Overview

This guide explains how Model Context Protocol (MCP) and LangChain work together in the meeting scheduler application, and how you can leverage both for powerful AI-driven scheduling.

## What is MCP?

**Model Context Protocol (MCP)** is a standardized protocol that allows AI models to interact with external tools and services. It provides:

- **Tool Registration**: Define tools that AI models can call
- **Structured Input/Output**: Type-safe schemas using Zod
- **Server-Sent Events (SSE)**: Real-time communication with AI clients
- **Standardized Interface**: Works with Claude Desktop, IDEs, and other MCP clients

## What is LangChain?

**LangChain** is a framework for building applications with Large Language Models (LLMs). It provides:

- **Chains**: Sequence multiple LLM calls and operations
- **Agents**: LLMs that can use tools to accomplish tasks
- **Memory**: Maintain conversation context
- **Parsers**: Extract structured data from LLM outputs

## Current Architecture

### MCP Server (Existing)

Located in `backend/src/mcp/`:

```typescript
// mcp.service.ts
@Injectable()
export class McpService {
  private server: McpServer;
  
  registerTools() {
    // Tool 1: Suggest meeting times
    this.server.registerTool('suggest_meeting_times', {
      description: 'Suggest meeting times based on availability',
      inputSchema: meetingParamsSchema
    }, async (args) => {
      return await this.schedulingService.suggestSlots(args);
    });
    
    // Tool 2: Schedule meeting
    this.server.registerTool('schedule_meeting', {
      description: 'Schedule a meeting with the best available slot',
      inputSchema: meetingParamsSchema
    }, async (args) => {
      return await this.schedulingService.scheduleMeeting(args);
    });
  }
}
```

**Endpoints:**
- `GET /mcp/sse` - Establish SSE connection
- `POST /mcp/messages` - Send messages to MCP server

### LangChain Service (Existing)

Located in `backend/src/langchain/`:

```typescript
// conversational.service.ts
@Injectable()
export class ConversationalService {
  private intentParser: IntentParser;
  private meetingParser: MeetingParser;
  
  async processMessage(sessionId, message, userEmail) {
    // 1. Classify intent
    const intent = await this.intentParser.classifyIntent(message);
    
    // 2. Extract meeting data
    const meetingData = await this.meetingParser.extractMeetingData(message);
    
    // 3. Check availability
    const availability = await this.schedulingService.checkAvailability(...);
    
    // 4. Schedule if confirmed
    if (intent === 'confirm') {
      await this.schedulingService.scheduleMeeting(...);
    }
  }
}
```

**Endpoint:**
- `POST /chat/message` - Conversational interface

## Integration Strategies

### Strategy 1: MCP Tools for LangChain Agents

**Concept**: Use MCP-registered tools as LangChain agent tools.

**Benefits:**
- Single source of truth for tool definitions
- MCP tools can be used by both LangChain and external MCP clients
- Standardized tool interface

**Implementation:**

```typescript
// langchain/tools/mcp-tools.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { McpService } from '../../mcp/mcp.service';

export class McpToolAdapter {
  static createLangChainTools(mcpService: McpService) {
    return [
      new DynamicStructuredTool({
        name: 'suggest_meeting_times',
        description: 'Suggest meeting times based on availability',
        schema: z.object({
          organizer: z.string().email(),
          attendees: z.array(z.string().email()),
          start: z.string().datetime(),
          end: z.string().datetime(),
        }),
        func: async (input) => {
          const result = await mcpService.callTool('suggest_meeting_times', input);
          return JSON.stringify(result);
        },
      }),
      
      new DynamicStructuredTool({
        name: 'schedule_meeting',
        description: 'Schedule a meeting with the best available slot',
        schema: z.object({
          organizer: z.string().email(),
          attendees: z.array(z.string().email()),
          start: z.string().datetime(),
          end: z.string().datetime(),
        }),
        func: async (input) => {
          const result = await mcpService.callTool('schedule_meeting', input);
          return JSON.stringify(result);
        },
      }),
    ];
  }
}
```

**Usage in LangChain Agent:**

```typescript
// langchain/agent.service.ts
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { McpToolAdapter } from './tools/mcp-tools';

@Injectable()
export class AgentService {
  constructor(
    private mcpService: McpService,
    private schedulingService: SchedulingService
  ) {}
  
  async createAgent() {
    const model = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0,
    });
    
    // Convert MCP tools to LangChain tools
    const tools = McpToolAdapter.createLangChainTools(this.mcpService);
    
    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools,
      prompt: ChatPromptTemplate.fromMessages([
        ['system', 'You are a helpful meeting scheduling assistant...'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]),
    });
    
    return new AgentExecutor({
      agent,
      tools,
    });
  }
  
  async processWithAgent(userMessage: string) {
    const executor = await this.createAgent();
    const result = await executor.invoke({
      input: userMessage,
    });
    return result.output;
  }
}
```

### Strategy 2: LangChain for Intent, MCP for Execution

**Concept**: Use LangChain for natural language understanding, MCP for tool execution.

**Benefits:**
- LangChain handles conversation flow and context
- MCP provides standardized tool interface
- Best of both worlds

**Implementation:**

```typescript
// langchain/hybrid.service.ts
@Injectable()
export class HybridService {
  constructor(
    private intentParser: IntentParser,
    private meetingParser: MeetingParser,
    private mcpService: McpService
  ) {}
  
  async processMessage(sessionId: string, message: string, userEmail: string) {
    // 1. Use LangChain for understanding
    const intent = await this.intentParser.classifyIntent(message);
    const meetingData = await this.meetingParser.extractMeetingData(message);
    
    // 2. Use MCP for execution
    if (intent.intent === 'schedule_new' && meetingData.isComplete) {
      const result = await this.mcpService.callTool('suggest_meeting_times', {
        organizer: userEmail,
        attendees: meetingData.attendees,
        start: meetingData.startTime,
        end: meetingData.endTime,
      });
      
      // 3. Format response using LangChain
      const response = await this.formatResponse(result);
      return response;
    }
  }
}
```

### Strategy 3: MCP Server with LangChain Memory

**Concept**: Enhance MCP tools with LangChain's conversation memory.

**Benefits:**
- MCP tools become context-aware
- Multi-turn conversations through MCP
- Stateful tool execution

**Implementation:**

```typescript
// mcp/stateful-mcp.service.ts
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';

@Injectable()
export class StatefulMcpService extends McpService {
  private sessions = new Map<string, BufferMemory>();
  
  registerTools() {
    super.registerTools();
    
    // Add conversational tool
    this.server.registerTool(
      'conversational_schedule',
      {
        description: 'Schedule a meeting through conversation',
        inputSchema: z.object({
          sessionId: z.string(),
          message: z.string(),
          userEmail: z.string().email(),
        }),
      },
      async (args) => {
        const { sessionId, message, userEmail } = args;
        
        // Get or create memory for this session
        let memory = this.sessions.get(sessionId);
        if (!memory) {
          memory = new BufferMemory();
          this.sessions.set(sessionId, memory);
        }
        
        // Create conversation chain with memory
        const chain = new ConversationChain({
          llm: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
          memory,
        });
        
        // Process message with context
        const response = await chain.call({ input: message });
        
        return {
          content: [{ type: 'text', text: response.response }],
        };
      }
    );
  }
}
```

## Practical Use Cases

### Use Case 1: Claude Desktop Integration

**Scenario**: Use Claude Desktop to schedule meetings via MCP.

**Setup:**

1. Add MCP server to Claude Desktop config:
```json
{
  "mcpServers": {
    "meeting-scheduler": {
      "command": "node",
      "args": ["dist/mcp-standalone.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "AZURE_CLIENT_ID": "..."
      }
    }
  }
}
```

2. Claude can now use the tools:
```
User: Schedule a meeting with john@example.com tomorrow at 10am
Claude: [Uses suggest_meeting_times tool]
        I found these available times:
        1. Tomorrow 10:00 AM - 10:30 AM
        2. Tomorrow 11:00 AM - 11:30 AM
        Which would you prefer?
User: The first one
Claude: [Uses schedule_meeting tool]
        Meeting scheduled successfully!
```

### Use Case 2: Web Chat with Agent

**Scenario**: Web interface with autonomous agent that uses MCP tools.

**Flow:**
```
User → Chat UI → LangChain Agent → MCP Tools → Microsoft Graph API
```

**Code:**
```typescript
// langchain/agent-chat.controller.ts
@Controller('agent-chat')
export class AgentChatController {
  constructor(private agentService: AgentService) {}
  
  @Post('message')
  async chat(@Body() body: { message: string, userEmail: string }) {
    // Agent automatically decides which MCP tools to use
    const response = await this.agentService.processWithAgent(
      body.message,
      body.userEmail
    );
    return { response };
  }
}
```

### Use Case 3: Hybrid Approach (Current + Enhanced)

**Scenario**: Keep current conversational flow, add MCP for external clients.

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Clients                      │
├──────────────────┬──────────────────┬───────────────────┤
│   Web Chat UI    │  Claude Desktop  │   VS Code MCP     │
└────────┬─────────┴────────┬─────────┴─────────┬─────────┘
         │                  │                   │
         ▼                  ▼                   ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ /chat/message   │  │  /mcp/sse    │  │  /mcp/messages   │
│ (LangChain)     │  │  (MCP)       │  │  (MCP)           │
└────────┬────────┘  └──────┬───────┘  └────────┬─────────┘
         │                  │                   │
         └──────────────────┴───────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Scheduling Service  │
                 │  (Shared Logic)      │
                 └──────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Microsoft Graph API │
                 └──────────────────────┘
```

## Implementation Roadmap

### Phase 1: Tool Adapter (Quick Win)
- [ ] Create `McpToolAdapter` class
- [ ] Convert MCP tools to LangChain tools
- [ ] Test with simple agent

### Phase 2: Enhanced Agent
- [ ] Build LangChain agent with MCP tools
- [ ] Add conversation memory
- [ ] Create `/agent-chat` endpoint

### Phase 3: Unified Service
- [ ] Refactor common logic into shared service
- [ ] Both MCP and LangChain use same underlying functions
- [ ] Add comprehensive logging

### Phase 4: Advanced Features
- [ ] Multi-agent collaboration
- [ ] Tool chaining (suggest → review → schedule)
- [ ] Custom MCP resources for calendar data

## Code Example: Complete Integration

```typescript
// langchain/mcp-agent.service.ts
import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { McpService } from '../mcp/mcp.service';
import { z } from 'zod';

@Injectable()
export class McpAgentService {
  constructor(private mcpService: McpService) {}

  private createTools() {
    return [
      new DynamicStructuredTool({
        name: 'suggest_meeting_times',
        description: 'Find available meeting times for attendees',
        schema: z.object({
          organizer: z.string().email(),
          attendees: z.array(z.string().email()),
          start: z.string(),
          end: z.string(),
        }),
        func: async (input) => {
          // Call MCP tool through the service
          const result = await this.mcpService.executeTool(
            'suggest_meeting_times',
            input
          );
          return JSON.stringify(result, null, 2);
        },
      }),
      
      new DynamicStructuredTool({
        name: 'schedule_meeting',
        description: 'Schedule a meeting at a specific time',
        schema: z.object({
          organizer: z.string().email(),
          attendees: z.array(z.string().email()),
          start: z.string(),
          end: z.string(),
          subject: z.string().optional(),
        }),
        func: async (input) => {
          const result = await this.mcpService.executeTool(
            'schedule_meeting',
            input
          );
          return JSON.stringify(result, null, 2);
        },
      }),
    ];
  }

  async chat(userMessage: string, userEmail: string) {
    const model = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0,
    });

    const tools = this.createTools();

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful meeting scheduling assistant. 
         You have access to tools to check availability and schedule meetings.
         The user's email is: ${userEmail}
         
         When scheduling meetings:
         1. First suggest available times
         2. Wait for user confirmation
         3. Then schedule the meeting
         
         Always be conversational and helpful.`,
      ],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools,
      prompt,
    });

    const executor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
    });

    const result = await executor.invoke({
      input: userMessage,
    });

    return result.output;
  }
}
```

## Best Practices

### 1. Tool Design
- **Single Responsibility**: Each tool does one thing well
- **Clear Descriptions**: Help LLM understand when to use each tool
- **Type Safety**: Use Zod schemas for validation

### 2. Error Handling
```typescript
async func(input) {
  try {
    const result = await this.mcpService.executeTool('tool_name', input);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error: error.message,
      suggestion: 'Try rephrasing your request'
    });
  }
}
```

### 3. Logging
```typescript
this.logger.log(`[MCP Tool] ${toolName} called with:`, input);
this.logger.log(`[MCP Tool] ${toolName} result:`, result);
```

### 4. Testing
```typescript
describe('MCP + LangChain Integration', () => {
  it('should suggest meeting times via agent', async () => {
    const response = await agentService.chat(
      'Find times to meet with john@example.com tomorrow',
      'alice@example.com'
    );
    expect(response).toContain('available');
  });
});
```

## Conclusion

MCP and LangChain complement each other perfectly:

- **MCP** provides standardized tool interfaces for AI models
- **LangChain** provides conversation management and agent orchestration

Together, they enable:
- ✅ Conversational scheduling through web chat
- ✅ Tool-based scheduling through Claude Desktop
- ✅ Autonomous agents that can plan and execute
- ✅ Reusable tools across multiple AI platforms

The key is to use MCP for **what to do** (tools) and LangChain for **how to decide** (agents).
