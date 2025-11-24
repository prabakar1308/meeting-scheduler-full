# Microsoft Teams Bot Integration with MCP Server

## Overview

This guide explains how to integrate your MCP server with a Microsoft Teams bot, allowing users to schedule meetings directly through Teams chat using natural language.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Microsoft Teams                          │
│                                                              │
│  User: "Schedule a meeting with Alice tomorrow at 2pm"      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   Teams Bot (Node.js)                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Bot Framework SDK                                     │  │
│  │  • Receives user messages                             │  │
│  │  • Parses intent (using AI or regex)                  │  │
│  │  • Calls MCP server                                   │  │
│  │  • Formats and sends response                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              MCP Server (Your Backend)                       │
│  • /mcp/sse - SSE connection                                 │
│  • /mcp/messages - JSON-RPC messages                         │
│  • Tools: suggest_meeting_times, schedule_meeting           │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Approach

### Option 1: Direct MCP Integration (Recommended)

The Teams bot acts as an MCP client, connecting to your MCP server to use the scheduling tools.

### Option 2: REST API Wrapper

The Teams bot uses your existing REST API endpoints (`/scheduling/*`) instead of MCP.

**We'll implement Option 1** as it demonstrates full MCP integration.

---

## Prerequisites

1. **Azure Account** - For bot registration
2. **Microsoft Teams** - For testing
3. **Node.js** - v18 or higher
4. **Your MCP Server** - Running on `http://localhost:4000`

---

## Step 1: Register Bot in Azure

### 1.1 Create Bot Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Azure Bot" and click "Create"
3. Fill in the details:
   - **Bot handle**: `meeting-scheduler-bot`
   - **Subscription**: Your subscription
   - **Resource group**: Create new or use existing
   - **Pricing tier**: F0 (Free)
   - **Microsoft App ID**: Create new

4. Click "Create"

### 1.2 Get Credentials

1. Go to your bot resource
2. Navigate to "Configuration"
3. Copy the **Microsoft App ID**
4. Click "Manage" next to App ID
5. Create a new **Client Secret**
6. Copy the secret value (you won't see it again!)

### 1.3 Configure Messaging Endpoint

1. In bot configuration, set **Messaging endpoint**:
   - Development: `https://your-ngrok-url.ngrok.io/api/messages`
   - Production: `https://your-domain.com/api/messages`

---

## Step 2: Create Teams Bot Project

### 2.1 Initialize Project

```bash
mkdir teams-meeting-bot
cd teams-meeting-bot
npm init -y
```

### 2.2 Install Dependencies

```bash
npm install botbuilder botbuilder-dialogs restify dotenv
npm install @modelcontextprotocol/sdk eventsource axios
npm install --save-dev @types/node @types/restify typescript
```

### 2.3 Project Structure

```
teams-meeting-bot/
├── src/
│   ├── bot.ts              # Main bot logic
│   ├── mcpClient.ts        # MCP client wrapper
│   ├── dialogs/
│   │   └── schedulingDialog.ts
│   └── index.ts            # Entry point
├── .env
├── package.json
└── tsconfig.json
```

---

## Step 3: Implement MCP Client

### src/mcpClient.ts

```typescript
import { EventSource } from 'eventsource';
import axios from 'axios';

export class MCPClient {
  private eventSource: EventSource | null = null;
  private sessionEndpoint: string | null = null;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:4000/mcp/sse') {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.serverUrl);

      this.eventSource.addEventListener('endpoint', (event: any) => {
        this.sessionEndpoint = new URL(event.data, 'http://localhost:4000').toString();
        console.log('MCP Connected:', this.sessionEndpoint);
        resolve();
      });

      this.eventSource.onerror = (error) => {
        console.error('MCP Connection error:', error);
        reject(error);
      };
    });
  }

  async suggestMeetingTimes(params: {
    organizer: string;
    attendees: string[];
    start: string;
    end: string;
  }): Promise<any> {
    if (!this.sessionEndpoint) {
      throw new Error('Not connected to MCP server');
    }

    const response = await axios.post(this.sessionEndpoint, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'suggest_meeting_times',
        arguments: params
      }
    });

    return response.data;
  }

  async scheduleMeeting(params: {
    organizer: string;
    attendees: string[];
    start: string;
    end: string;
  }): Promise<any> {
    if (!this.sessionEndpoint) {
      throw new Error('Not connected to MCP server');
    }

    const response = await axios.post(this.sessionEndpoint, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'schedule_meeting',
        arguments: params
      }
    });

    return response.data;
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.sessionEndpoint = null;
    }
  }
}
```

---

## Step 4: Implement Teams Bot

### src/bot.ts

```typescript
import { ActivityHandler, TurnContext, MessageFactory } from 'botbuilder';
import { MCPClient } from './mcpClient';

export class MeetingSchedulerBot extends ActivityHandler {
  private mcpClient: MCPClient;

  constructor() {
    super();

    this.mcpClient = new MCPClient(process.env.MCP_SERVER_URL);

    // Connect to MCP server on startup
    this.mcpClient.connect().catch(console.error);

    // Handle incoming messages
    this.onMessage(async (context, next) => {
      const userMessage = context.activity.text.toLowerCase();

      try {
        if (userMessage.includes('suggest') || userMessage.includes('available')) {
          await this.handleSuggestMeeting(context);
        } else if (userMessage.includes('schedule') || userMessage.includes('book')) {
          await this.handleScheduleMeeting(context);
        } else if (userMessage.includes('help')) {
          await this.sendHelpMessage(context);
        } else {
          await context.sendActivity('I can help you schedule meetings! Try:\n' +
            '- "Suggest meeting times with alice@example.com"\n' +
            '- "Schedule a meeting with bob@example.com tomorrow at 2pm"');
        }
      } catch (error) {
        console.error('Error:', error);
        await context.sendActivity('Sorry, I encountered an error. Please try again.');
      }

      await next();
    });

    // Handle members added
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await this.sendWelcomeMessage(context);
        }
      }
      await next();
    });
  }

  private async handleSuggestMeeting(context: TurnContext): Promise<void> {
    await context.sendActivity('Let me suggest some meeting times...');

    // Parse user input (simplified - use NLP in production)
    const userEmail = context.activity.from.email || 'user@example.com';
    const attendees = this.extractEmails(context.activity.text);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(17, 0, 0, 0);

    const result = await this.mcpClient.suggestMeetingTimes({
      organizer: userEmail,
      attendees: attendees.length > 0 ? attendees : ['alice@example.com'],
      start: tomorrow.toISOString(),
      end: endOfDay.toISOString()
    });

    // Format and send response
    const suggestions = this.formatSuggestions(result);
    await context.sendActivity(suggestions);
  }

  private async handleScheduleMeeting(context: TurnContext): Promise<void> {
    await context.sendActivity('Scheduling your meeting...');

    const userEmail = context.activity.from.email || 'user@example.com';
    const attendees = this.extractEmails(context.activity.text);
    const timeSlot = this.extractTimeSlot(context.activity.text);

    const result = await this.mcpClient.scheduleMeeting({
      organizer: userEmail,
      attendees: attendees.length > 0 ? attendees : ['alice@example.com'],
      start: timeSlot.start,
      end: timeSlot.end
    });

    await context.sendActivity('✅ Meeting scheduled successfully!');
  }

  private extractEmails(text: string): string[] {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    return text.match(emailRegex) || [];
  }

  private extractTimeSlot(text: string): { start: string; end: string } {
    // Simplified time parsing - use a proper NLP library in production
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0); // Default to 2 PM

    const end = new Date(tomorrow);
    end.setHours(15, 0, 0, 0); // 1 hour duration

    return {
      start: tomorrow.toISOString(),
      end: end.toISOString()
    };
  }

  private formatSuggestions(result: any): string {
    // Parse MCP response and format for Teams
    const content = result.result?.content?.[0]?.text;
    if (content) {
      const data = JSON.parse(content);
      return `Here are some available times:\n${JSON.stringify(data, null, 2)}`;
    }
    return 'No suggestions available.';
  }

  private async sendWelcomeMessage(context: TurnContext): Promise<void> {
    await context.sendActivity(
      '👋 Hi! I\'m your Meeting Scheduler bot.\n\n' +
      'I can help you:\n' +
      '- Suggest meeting times\n' +
      '- Schedule meetings\n\n' +
      'Try saying "suggest meeting times with alice@example.com"'
    );
  }

  private async sendHelpMessage(context: TurnContext): Promise<void> {
    await context.sendActivity(
      '**Available Commands:**\n\n' +
      '📅 **Suggest Times**: "Suggest meeting times with alice@example.com"\n' +
      '📆 **Schedule Meeting**: "Schedule a meeting with bob@example.com tomorrow at 2pm"\n\n' +
      'Just type naturally and I\'ll help you schedule!'
    );
  }
}
```

---

## Step 5: Create Server Entry Point

### src/index.ts

```typescript
import * as restify from 'restify';
import { BotFrameworkAdapter } from 'botbuilder';
import { MeetingSchedulerBot } from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

// Create adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error(`\n [onTurnError] unhandled error: ${error}`);
  await context.sendActivity('The bot encountered an error.');
};

// Create bot
const bot = new MeetingSchedulerBot();

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(process.env.PORT || 3978, () => {
  console.log(`\n${server.name} listening on ${server.url}`);
  console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
});

// Listen for incoming requests
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});
```

---

## Step 6: Configuration

### .env

```env
# Bot Credentials
MICROSOFT_APP_ID=your-app-id-from-azure
MICROSOFT_APP_PASSWORD=your-app-secret-from-azure

# Server
PORT=3978

# MCP Server
MCP_SERVER_URL=http://localhost:4000/mcp/sse
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### package.json (scripts)

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc && node dist/index.js",
    "watch": "tsc --watch"
  }
}
```

---

## Step 7: Local Testing with ngrok

### 7.1 Install ngrok

```bash
npm install -g ngrok
```

### 7.2 Start Your Services

```bash
# Terminal 1: Start your MCP backend
cd backend
npm run start:dev

# Terminal 2: Start Teams bot
cd teams-meeting-bot
npm run dev

# Terminal 3: Start ngrok
ngrok http 3978
```

### 7.3 Update Azure Bot Configuration

1. Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
2. Go to Azure Portal → Your Bot → Configuration
3. Update **Messaging endpoint**: `https://abc123.ngrok.io/api/messages`
4. Save

---

## Step 8: Test in Teams

### 8.1 Add Bot to Teams

1. In Azure Portal, go to your bot
2. Click "Channels"
3. Click "Microsoft Teams" icon
4. Click "Open in Teams"

### 8.2 Test Commands

Try these messages in Teams:

```
"suggest meeting times with alice@example.com"
"schedule a meeting with bob@example.com tomorrow at 2pm"
"help"
```

---

## Advanced Features

### Natural Language Processing

For better intent recognition, integrate Azure LUIS or OpenAI:

```typescript
import { OpenAI } from 'openai';

async function parseIntent(message: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: 'Extract meeting details from user message. Return JSON with: action, attendees, date, time'
    }, {
      role: 'user',
      content: message
    }]
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### Adaptive Cards

Create rich, interactive cards:

```typescript
import { CardFactory } from 'botbuilder';

const card = CardFactory.adaptiveCard({
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      text: 'Meeting Scheduled!',
      weight: 'Bolder',
      size: 'Large'
    },
    {
      type: 'FactSet',
      facts: [
        { title: 'Organizer:', value: 'user@example.com' },
        { title: 'Attendees:', value: 'alice@example.com' },
        { title: 'Time:', value: '2025-11-24 14:00' }
      ]
    }
  ],
  actions: [
    {
      type: 'Action.OpenUrl',
      title: 'View in Calendar',
      url: 'https://outlook.office.com/calendar'
    }
  ],
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.4'
});

await context.sendActivity({ attachments: [card] });
```

---

## Production Deployment

### Azure App Service

```bash
# Create App Service
az webapp create \
  --resource-group myResourceGroup \
  --plan myAppServicePlan \
  --name meeting-scheduler-bot \
  --runtime "NODE|18-lts"

# Deploy
az webapp deployment source config-zip \
  --resource-group myResourceGroup \
  --name meeting-scheduler-bot \
  --src bot.zip
```

### Environment Variables

Set in Azure App Service:
- `MICROSOFT_APP_ID`
- `MICROSOFT_APP_PASSWORD`
- `MCP_SERVER_URL` (production URL)

---

## Summary

You now have a Microsoft Teams bot that:
- ✅ Connects to your MCP server
- ✅ Uses MCP tools to suggest and schedule meetings
- ✅ Responds to natural language commands
- ✅ Works in Teams chat

The bot acts as an MCP client, bridging Teams users with your scheduling backend through the standardized MCP protocol!
