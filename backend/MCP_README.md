# MCP (Model Context Protocol) - Explanation

## What is MCP?

**MCP (Model Context Protocol)** is a standardized protocol that allows AI assistants and LLMs to interact with external tools and data sources in a consistent, discoverable way. Think of it as a "universal adapter" that lets AI models call functions and access resources across different applications.

## Your Meeting Scheduler: With vs Without MCP

### **WITHOUT MCP** (Current REST API approach)

Your backend already has REST endpoints:
- `POST /scheduling/suggest` - Suggest meeting times
- `POST /scheduling/schedule` - Schedule a meeting

**How it works:**
1. A client (human or AI) needs to **know** these endpoints exist
2. They must **manually** construct HTTP requests with the right format
3. There's **no automatic discovery** - you need documentation
4. Each integration requires **custom code**

**Example:** If Claude or ChatGPT wanted to help schedule meetings, a developer would need to:
```javascript
// Manual integration - developer writes custom code
const response = await fetch('http://localhost:4000/scheduling/suggest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizer: 'user@example.com',
    attendees: ['alice@example.com'],
    start: '2025-11-24T09:00:00Z',
    end: '2025-11-24T17:00:00Z'
  })
});
```

---

### **WITH MCP** (What we just implemented)

Your backend now **also** exposes an MCP server at:
- `GET /mcp/sse` - MCP connection endpoint
- `POST /mcp/messages` - MCP message handling

**How it works:**
1. AI assistants can **automatically discover** available tools
2. They get **complete schemas** describing parameters and types
3. **Zero custom code** needed - MCP clients handle everything
4. **Standardized protocol** - works with any MCP-compatible AI

**Example:** Claude Desktop (with MCP support) can now:
```javascript
// AI automatically discovers and calls tools
// 1. Connect to MCP server
// 2. List available tools -> finds "suggest_meeting_times"
// 3. See the schema -> knows it needs organizer, attendees, start, end
// 4. Call the tool with proper parameters
// All handled automatically by the MCP protocol!
```

---

## Key Benefits of MCP

### 1. **Automatic Discovery**
```json
// AI asks: "What can you do?"
// MCP responds with full tool catalog:
{
  "tools": [
    {
      "name": "suggest_meeting_times",
      "description": "Suggest meeting times based on availability",
      "inputSchema": { /* complete JSON schema */ }
    }
  ]
}
```

### 2. **Type Safety & Validation**
The AI knows exactly what parameters are required, their types, and formats:
- `organizer`: string (email format)
- `attendees`: array of strings (email format)
- `start`/`end`: datetime strings (ISO 8601)

### 3. **Standardization**
One protocol works across:
- Claude Desktop
- ChatGPT (when they add MCP support)
- Custom AI agents
- Any MCP-compatible client

### 4. **No Custom Integration Code**
Instead of writing custom code for each AI platform, you expose **one MCP server** that works with all of them.

---

## Real-World Analogy

**Without MCP:** Like having a restaurant with no menu - customers need to call and ask what's available, then describe exactly how they want their food prepared.

**With MCP:** Like having a digital menu with photos, descriptions, and allergen info - customers can browse, understand options, and order confidently.

---

## In Your Project

You now have **both approaches**:

1. **REST API** (`/scheduling/*`) - For traditional web/mobile apps
2. **MCP Server** (`/mcp/*`) - For AI assistants and agents

This gives you maximum flexibility - humans use the REST API through your frontend, while AI assistants use the MCP server to help users schedule meetings through natural conversation!

---

## Available MCP Tools

### 1. `suggest_meeting_times`
Suggests optimal meeting times based on participant availability.

**Parameters:**
- `organizer` (string, email): Email address of the meeting organizer
- `attendees` (array of strings, email): Array of attendee email addresses
- `start` (string, ISO 8601 datetime): Start of the time window
- `end` (string, ISO 8601 datetime): End of the time window

**Returns:** Ranked list of available meeting slots

### 2. `schedule_meeting`
Schedules a meeting using the best available time slot.

**Parameters:**
- `organizer` (string, email): Email address of the meeting organizer
- `attendees` (array of strings, email): Array of attendee email addresses
- `start` (string, ISO 8601 datetime): Start of the time window
- `end` (string, ISO 8601 datetime): End of the time window

**Returns:** Confirmation of the scheduled meeting

---

## Testing the MCP Server

A test script is provided at [`test-mcp.js`](./test-mcp.js):

```bash
node test-mcp.js
```

This will:
1. Connect to the MCP server via SSE
2. Request the list of available tools
3. Display the complete tool schemas

---

## Connecting MCP Clients

To connect an MCP-compatible client (like Claude Desktop):

1. Ensure the backend is running: `npm run start:dev`
2. MCP server is available at: `http://localhost:4000/mcp/sse`
3. Configure your MCP client to connect to this endpoint

---

## Technical Implementation

The MCP server is implemented using:
- **`@modelcontextprotocol/sdk`** - Official MCP SDK
- **Zod v3** - Schema validation (bundled with SDK)
- **SSE (Server-Sent Events)** - Real-time communication transport
- **NestJS** - Backend framework integration

Key files:
- [`src/mcp/mcp.module.ts`](./src/mcp/mcp.module.ts) - MCP module definition
- [`src/mcp/mcp.service.ts`](./src/mcp/mcp.service.ts) - Tool registration and MCP server logic
- [`src/mcp/mcp.controller.ts`](./src/mcp/mcp.controller.ts) - HTTP endpoints for MCP communication
