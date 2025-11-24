# MCP Client Integration Guide

## Overview

This guide walks you through connecting AI assistants (like Claude Desktop) to your Meeting Scheduler MCP server.

---

## Prerequisites

- ✅ Backend server running (`npm run start:dev`)
- ✅ MCP server available at `http://localhost:4000/mcp/sse`
- ✅ An MCP-compatible client (Claude Desktop, custom client, etc.)

---

## Option 1: Claude Desktop Integration

### Step 1: Install Claude Desktop

Download and install Claude Desktop from:
- **macOS**: [https://claude.ai/download](https://claude.ai/download)
- **Windows**: [https://claude.ai/download](https://claude.ai/download)

### Step 2: Configure MCP Server

Claude Desktop uses a configuration file to connect to MCP servers.

**Configuration File Location:**

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Create/Edit the configuration file:**

```json
{
  "mcpServers": {
    "meeting-scheduler": {
      "command": "node",
      "args": [
        "-e",
        "const { EventSource } = require('eventsource'); const es = new EventSource('http://localhost:4000/mcp/sse'); es.onmessage = (e) => console.log(e.data); es.onerror = (e) => console.error(e);"
      ],
      "env": {}
    }
  }
}
```

**Alternative: Using SSE Transport Directly**

If Claude Desktop supports SSE URLs directly:

```json
{
  "mcpServers": {
    "meeting-scheduler": {
      "url": "http://localhost:4000/mcp/sse",
      "transport": "sse"
    }
  }
}
```

### Step 3: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Relaunch the application
3. Claude will automatically connect to your MCP server

### Step 4: Verify Connection

In Claude Desktop, try asking:

```
"What tools do you have available?"
```

Claude should respond with information about the `suggest_meeting_times` and `schedule_meeting` tools.

### Step 5: Test the Tools

Try these example prompts:

```
"Suggest meeting times for me (user@example.com) and alice@example.com 
between 9 AM and 5 PM tomorrow"
```

```
"Schedule a meeting with bob@example.com tomorrow at 2 PM for 1 hour"
```

---

## Option 2: Custom MCP Client (Node.js)

### Installation

```bash
npm install @modelcontextprotocol/sdk eventsource
```

### Basic Client Implementation

```javascript
// mcp-client.js
const { EventSource } = require('eventsource');
const axios = require('axios');

class MeetingSchedulerClient {
  constructor(serverUrl = 'http://localhost:4000/mcp/sse') {
    this.serverUrl = serverUrl;
    this.eventSource = null;
    this.sessionEndpoint = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.serverUrl);

      this.eventSource.addEventListener('endpoint', (event) => {
        this.sessionEndpoint = new URL(event.data, 'http://localhost:4000').toString();
        console.log('Connected! Session endpoint:', this.sessionEndpoint);
        resolve();
      });

      this.eventSource.onerror = (error) => {
        console.error('Connection error:', error);
        reject(error);
      };

      this.eventSource.onmessage = (event) => {
        console.log('Received:', event.data);
      };
    });
  }

  async listTools() {
    const response = await axios.post(this.sessionEndpoint, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    return response.data;
  }

  async callTool(toolName, args) {
    const response = await axios.post(this.sessionEndpoint, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
    return response.data;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Usage Example
async function main() {
  const client = new MeetingSchedulerClient();

  try {
    // Connect to server
    await client.connect();

    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:', JSON.stringify(tools, null, 2));

    // Suggest meeting times
    const suggestions = await client.callTool('suggest_meeting_times', {
      organizer: 'user@example.com',
      attendees: ['alice@example.com'],
      start: '2025-11-24T09:00:00Z',
      end: '2025-11-24T17:00:00Z'
    });
    console.log('Suggestions:', JSON.stringify(suggestions, null, 2));

    // Schedule a meeting
    const scheduled = await client.callTool('schedule_meeting', {
      organizer: 'user@example.com',
      attendees: ['alice@example.com'],
      start: '2025-11-24T14:00:00Z',
      end: '2025-11-24T15:00:00Z'
    });
    console.log('Scheduled:', JSON.stringify(scheduled, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.disconnect();
  }
}

main();
```

### Run the Client

```bash
node mcp-client.js
```

---

## Option 3: Python MCP Client

### Installation

```bash
pip install mcp httpx sse-client
```

### Basic Client Implementation

```python
# mcp_client.py
import json
import httpx
from sseclient import SSEClient

class MeetingSchedulerClient:
    def __init__(self, server_url='http://localhost:4000/mcp/sse'):
        self.server_url = server_url
        self.session_endpoint = None
        
    def connect(self):
        """Connect to MCP server via SSE"""
        messages = SSEClient(self.server_url)
        for msg in messages:
            if msg.event == 'endpoint':
                self.session_endpoint = f"http://localhost:4000{msg.data}"
                print(f"Connected! Session endpoint: {self.session_endpoint}")
                break
                
    def list_tools(self):
        """List available tools"""
        response = httpx.post(self.session_endpoint, json={
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/list',
            'params': {}
        })
        return response.json()
        
    def call_tool(self, tool_name, args):
        """Call a specific tool"""
        response = httpx.post(self.session_endpoint, json={
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': args
            }
        })
        return response.json()

# Usage
if __name__ == '__main__':
    client = MeetingSchedulerClient()
    client.connect()
    
    # List tools
    tools = client.list_tools()
    print(json.dumps(tools, indent=2))
    
    # Suggest meeting times
    suggestions = client.call_tool('suggest_meeting_times', {
        'organizer': 'user@example.com',
        'attendees': ['alice@example.com'],
        'start': '2025-11-24T09:00:00Z',
        'end': '2025-11-24T17:00:00Z'
    })
    print(json.dumps(suggestions, indent=2))
```

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to MCP server

**Solutions**:
1. Verify backend is running: `npm run start:dev`
2. Check server logs for errors
3. Ensure port 4000 is not blocked by firewall
4. Try accessing `http://localhost:4000/mcp/sse` in browser (should show SSE stream)

### Tool Discovery Issues

**Problem**: AI cannot see tools

**Solutions**:
1. Verify tools are registered: `node test-mcp.js`
2. Check MCP server logs for errors
3. Restart Claude Desktop after config changes
4. Verify JSON-RPC messages are properly formatted

### Authentication Issues

**Problem**: Need to add authentication

**Solution**: Modify `mcp.controller.ts` to add auth guards:

```typescript
import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('mcp')
export class McpController {
  @Get('sse')
  @UseGuards(AuthGuard('bearer')) // Add auth guard
  async handleSSE(@Req() req, @Res() res) {
    // ...
  }
}
```

---

## Production Deployment

### Environment Variables

```env
# .env
MCP_SERVER_URL=https://your-domain.com/mcp/sse
MCP_ALLOWED_ORIGINS=https://claude.ai,https://your-app.com
```

### CORS Configuration

Update `main.ts` to allow MCP client origins:

```typescript
app.enableCors({
  origin: process.env.MCP_ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
});
```

### HTTPS/WSS

For production, use HTTPS:
- MCP server URL: `https://your-domain.com/mcp/sse`
- Ensure SSL certificates are valid
- Configure reverse proxy (nginx/Apache) if needed

---

## Testing Your Integration

### Quick Test Checklist

- [ ] Backend server is running
- [ ] MCP endpoints are accessible
- [ ] Tools are discoverable (`tools/list` works)
- [ ] Tools can be called (`tools/call` works)
- [ ] Responses are properly formatted
- [ ] Error handling works correctly

### Test Commands

```bash
# Test SSE endpoint
curl -N http://localhost:4000/mcp/sse

# Test tool listing (after getting session endpoint)
curl -X POST http://localhost:4000/mcp/messages?sessionId=YOUR_SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Next Steps

1. **Configure your MCP client** (Claude Desktop or custom)
2. **Test the connection** using the examples above
3. **Try scheduling meetings** through natural language
4. **Monitor logs** to debug any issues
5. **Deploy to production** when ready

---

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Desktop Documentation](https://claude.ai/docs)
- [Test Script](./test-mcp.js) - Included in this project

---

## Support

If you encounter issues:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review server logs: `npm run start:dev`
3. Test with the included `test-mcp.js` script
4. Verify your configuration matches the examples
