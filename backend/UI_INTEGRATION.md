# UI Integration Guide - REST API vs MCP

## Overview

This guide explains how your frontend UI should interact with the backend and clarifies the role of MCP in the overall architecture.

---

## Quick Answer: What Should Your UI Use?

**Your UI should use the REST API endpoints, NOT the MCP server.**

### REST API Endpoints for UI

```javascript
// Suggest meeting times
POST http://localhost:4000/scheduling/suggest
{
  "organizer": "user@example.com",
  "attendees": ["alice@example.com", "bob@example.com"],
  "start": "2025-11-24T09:00:00Z",
  "end": "2025-11-24T17:00:00Z"
}

// Schedule a meeting
POST http://localhost:4000/scheduling/schedule
{
  "organizer": "user@example.com",
  "attendees": ["alice@example.com", "bob@example.com"],
  "start": "2025-11-24T14:00:00Z",
  "end": "2025-11-24T15:00:00Z"
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS)                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         SchedulingService (Core Logic)               │  │
│  │  • suggestSlots()                                    │  │
│  │  • scheduleMeeting()                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│           ▲                              ▲                  │
│           │                              │                  │
│  ┌────────┴────────┐          ┌─────────┴────────┐        │
│  │ REST Controller │          │   MCP Service    │        │
│  │ /scheduling/*   │          │   /mcp/*         │        │
│  └────────┬────────┘          └─────────┬────────┘        │
│           │                              │                  │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            │                              │
    ┌───────▼────────┐            ┌────────▼─────────┐
    │   Web UI       │            │  AI Assistants   │
    │  (React/Next)  │            │  (Claude, etc)   │
    │                │            │                  │
    │  Human users   │            │  AI agents       │
    │  interact via  │            │  interact via    │
    │  browser       │            │  MCP protocol    │
    └────────────────┘            └──────────────────┘
```

---

## Two Interfaces, Same Backend Logic

| Interface | Consumer | Protocol | Use Case |
|-----------|----------|----------|----------|
| **REST API** (`/scheduling/*`) | Your Web UI | HTTP/JSON | Human users via browser |
| **MCP Server** (`/mcp/*`) | AI Assistants | MCP/SSE | AI agents helping users |

**Key Point:** Both interfaces call the same `SchedulingService`, so:
- ✅ Meetings scheduled via UI are visible to AI
- ✅ Meetings scheduled via AI are visible in UI
- ✅ Single source of truth (same database)

---

## User Flow Comparison

### Traditional Flow (UI Only)
```
User → Web UI → REST API → SchedulingService → Database
```

**Example:**
1. User opens your web app
2. Navigates to "Schedule Meeting" page
3. Fills in form (attendees, time, etc.)
4. Clicks "Submit"
5. UI calls `POST /scheduling/schedule`
6. Backend processes and saves to database
7. UI shows confirmation

### AI-Assisted Flow (With MCP)
```
User → AI Assistant → MCP Server → SchedulingService → Database
                ↓
            Web UI (shows result)
```

**Example:**
1. User tells Claude: "Schedule a meeting with Alice tomorrow at 2pm"
2. Claude connects to MCP server (`/mcp/sse`)
3. Claude discovers `schedule_meeting` tool
4. Claude calls the tool with parameters
5. Backend processes and saves to database
6. Claude responds: "✅ Meeting scheduled!"
7. User can see the meeting in your web UI

---

## Frontend Implementation (React/Next.js Example)

### Suggesting Meeting Times

```typescript
// src/services/scheduling.ts
export async function suggestMeetingTimes(params: {
  organizer: string;
  attendees: string[];
  start: string;
  end: string;
}) {
  const response = await fetch('http://localhost:4000/scheduling/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to suggest meeting times');
  }

  return response.json();
}
```

### Scheduling a Meeting

```typescript
export async function scheduleMeeting(params: {
  organizer: string;
  attendees: string[];
  start: string;
  end: string;
}) {
  const response = await fetch('http://localhost:4000/scheduling/schedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to schedule meeting');
  }

  return response.json();
}
```

### React Component Example

```tsx
import { useState } from 'react';
import { suggestMeetingTimes, scheduleMeeting } from '@/services/scheduling';

export function ScheduleMeetingForm() {
  const [suggestions, setSuggestions] = useState([]);

  const handleSuggest = async () => {
    const result = await suggestMeetingTimes({
      organizer: 'user@example.com',
      attendees: ['alice@example.com'],
      start: '2025-11-24T09:00:00Z',
      end: '2025-11-24T17:00:00Z',
    });
    setSuggestions(result);
  };

  const handleSchedule = async (slot: any) => {
    await scheduleMeeting({
      organizer: 'user@example.com',
      attendees: ['alice@example.com'],
      start: slot.start,
      end: slot.end,
    });
    alert('Meeting scheduled!');
  };

  return (
    <div>
      <button onClick={handleSuggest}>Get Suggestions</button>
      {suggestions.map((slot, i) => (
        <div key={i}>
          <span>{slot.start} - {slot.end}</span>
          <button onClick={() => handleSchedule(slot)}>Schedule</button>
        </div>
      ))}
    </div>
  );
}
```

---

## MCP's Role: AI Integration Layer

### What MCP Does

MCP provides an **additional interface** for AI assistants to interact with your backend:

1. **Tool Discovery**: AI can ask "What can you do?" and get a list of available tools
2. **Schema Validation**: AI knows exactly what parameters each tool needs
3. **Automatic Execution**: AI can call tools without custom integration code

### What MCP Does NOT Do

- ❌ Replace your REST API
- ❌ Change how your UI works
- ❌ Require UI modifications
- ❌ Handle browser-based interactions

---

## Real-World Scenario

### Scenario: User wants to schedule a meeting

**Option 1: Via Web UI**
```
User → Opens browser → Your app → Fills form → Submits
       ↓
    REST API → SchedulingService → Database
```

**Option 2: Via AI Assistant (Claude Desktop)**
```
User → Tells Claude: "Schedule meeting with Alice at 2pm"
       ↓
    Claude → MCP Server → SchedulingService → Database
       ↓
    "Meeting scheduled!"
```

**Result:** Same meeting in database, visible in both UI and to AI!

---

## Summary

### For Frontend Developers:

1. **Use REST API** - Your UI development doesn't change
2. **Ignore MCP** - It's for AI assistants, not browsers
3. **Same Data** - Meetings from both sources appear in your UI

### For AI Integration:

1. **MCP is automatic** - No UI code needed
2. **AI discovers tools** - Claude/ChatGPT can find and use your scheduling functions
3. **Complementary** - Works alongside your UI, not instead of it

---

## Environment Variables

Make sure your frontend knows where the backend is:

```env
# .env.local (Frontend)
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Then use it in your API calls:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

fetch(`${API_URL}/scheduling/suggest`, {
  // ...
});
```

---

## Next Steps

1. **Build your UI** using the REST API endpoints
2. **Test with Postman/curl** to verify endpoints work
3. **Optionally**: Connect Claude Desktop to the MCP server to see AI-assisted scheduling in action
4. **Deploy**: Both REST and MCP endpoints work in production

The MCP server is a **bonus feature** that enables AI integration without requiring any changes to your existing UI architecture!
