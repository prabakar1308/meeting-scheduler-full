# LangChain Conversational Scheduling Flow

## Overview

This document describes the hybrid LangChain scheduling system that combines AI-powered natural language understanding with deterministic scheduling logic. The system allows users to schedule meetings through natural conversation while maintaining reliability through structured backend processes.

## Architecture

### High-Level Flow

```
User Message → Intent Classification → Entity Extraction → Availability Check → Booking
```

### Components

1. **Frontend**: React chat interface (`/chat`)
2. **Backend API**: NestJS controller (`/chat/message`)
3. **Conversational Service**: Orchestrates the scheduling flow
4. **Intent Parser**: Classifies user intent using GPT-4o-mini
5. **Meeting Parser**: Extracts meeting details from natural language
6. **Scheduling Service**: Handles availability and booking via Microsoft Graph API

## Conversation Flow

### 1. Intent Classification

When a user sends a message, the system first classifies their intent:

**Supported Intents:**
- `schedule_new`: User wants to schedule a new meeting
- `clarify`: User is providing additional information
- `confirm`: User is confirming an action ("Yes", "Go ahead")
- `select_slot`: User is selecting a time slot ("The first one", "Slot 2")
- `modify_existing`: User wants to modify a meeting
- `ask_question`: User is asking a question
- `cancel`: User wants to cancel the process

**Example:**
```
User: "Schedule a meeting with John tomorrow at 10am"
Intent: schedule_new (confidence: 0.95)
```

### 2. Entity Extraction

The Meeting Parser extracts structured data from the message:

**Extracted Fields:**
- `subject`: Meeting title
- `attendees`: List of email addresses or names
- `startTime`: ISO 8601 datetime in UTC
- `endTime`: ISO 8601 datetime in UTC
- `duration`: Duration in minutes

**Example:**
```json
{
  "subject": "team sync-up meeting",
  "attendees": ["john@example.com"],
  "startTime": "2025-11-26T04:30:00Z",
  "endTime": "2025-11-26T05:00:00Z",
  "duration": 30
}
```

### 3. User Lookup

The system automatically resolves names to email addresses:

**Input:** "Schedule with John"
**Process:**
1. Query Microsoft Graph for users
2. Search displayName, mail, userPrincipalName
3. Match case-insensitively
4. Return email address

**Output:** "john.doe@company.com"

### 4. Availability Check

The system checks if the requested time slot is available:

**Process:**
1. Call Microsoft Graph `getSchedule` API
2. Check for conflicts (busy/tentative)
3. If busy, find alternative slots using `findMeetingTimes`
4. Filter alternatives for business hours (9 AM - 6 PM IST)
5. Sort by proximity to requested time

**Response Options:**

**Option A: Slot Available**
```
"Good news! The slot Nov 26, 10:00 AM is available for all attendees. Shall I schedule it?"
```

**Option B: Slot Busy with Alternatives**
```
"That time doesn't work for everyone. Here are some alternatives:
1. Nov 26, 11:00 AM
2. Nov 26, 2:00 PM
3. Nov 26, 3:30 PM

Which one would you like?"
```

### 5. Slot Selection

User selects from proposed alternatives:

**User Input Examples:**
- "The first one"
- "Slot 2"
- "11am works"

**System Response:**
```
"You selected: Nov 26, 11:00 AM to Nov 26, 11:30 AM. Shall I schedule this?"
```

### 6. Confirmation & Booking

User confirms the booking:

**User:** "Yes"

**System Process:**
1. Format attendees for Microsoft Graph API
2. Create calendar event via `createEventForUser`
3. Send invitations to all attendees
4. Log meeting in database

**Response:**
```
"Meeting scheduled successfully! I've sent invites to all attendees."
```

## Session Management

Each conversation maintains state:

```typescript
interface ConversationSession {
  sessionId: string;
  organizerEmail?: string;
  context: {
    conversationHistory: string[];
    partialMeetingData?: Partial<MeetingData>;
    proposedSlots?: any[];
    pendingBooking?: any;
  };
}
```

**Session Lifecycle:**
1. Created on first message with unique session ID
2. Stores organizer email from authenticated user
3. Maintains conversation history for context
4. Tracks partial data across multiple messages
5. Stores proposed slots for selection
6. Holds pending booking until confirmation

## Authentication

### Token Flow

1. **Frontend**: User signs in with Microsoft Account (MSAL)
2. **Token Acquisition**: Frontend acquires access token silently
3. **API Requests**: Token sent in `Authorization: Bearer <token>` header
4. **Backend Validation**: 
   - Attempts Azure AD JWT validation
   - Falls back to manual JWT decoding if validation fails
5. **Email Extraction**: Extracts email from JWT payload
6. **Organizer Assignment**: Uses email as meeting organizer

### Supported JWT Fields

The system tries multiple fields to extract the user's email:
- `email`
- `preferred_username`
- `upn` (User Principal Name)
- `unique_name`

## API Endpoints

### POST `/chat/message`

**Request:**
```json
{
  "sessionId": "session-1732553400000",
  "message": "Schedule a meeting with john@example.com tomorrow at 10am"
}
```

**Response:**
```json
{
  "response": "Good news! The slot is available...",
  "intent": {
    "intent": "schedule_new",
    "confidence": 0.95
  },
  "meetingData": {
    "subject": "Meeting",
    "attendees": ["john@example.com"],
    "startTime": "2025-11-26T04:30:00Z"
  },
  "isComplete": true,
  "requiresScheduling": false
}
```

## Example Conversations

### Simple Scheduling

```
User: Schedule a meeting with sarah@example.com tomorrow at 2pm for 30 minutes
Bot: Good news! The slot Nov 26, 2:00 PM is available. Shall I schedule it?
User: Yes
Bot: Meeting scheduled successfully! I've sent invites to all attendees.
```

### With Name Resolution

```
User: Schedule a meeting with John tomorrow at 10am
Bot: Looking up user by name: John
     Resolved "John" to john.doe@company.com
     Good news! The slot is available. Shall I schedule it?
User: Yes
Bot: Meeting scheduled successfully!
```

### With Alternatives

```
User: Schedule a meeting with the team tomorrow at 10am
Bot: That time doesn't work for everyone. Here are some alternatives:
     1. Nov 26, 11:00 AM
     2. Nov 26, 2:00 PM
     Which one would you like?
User: The first one
Bot: You selected: Nov 26, 11:00 AM. Shall I schedule this?
User: Yes
Bot: Meeting scheduled successfully!
```

### Multi-Turn Clarification

```
User: Schedule a meeting tomorrow
Bot: I'd be happy to help! Could you provide:
     - Who should attend?
     - What time?
User: With John at 2pm
Bot: Got it! And how long should the meeting be?
User: 30 minutes
Bot: Perfect! The slot Nov 26, 2:00 PM is available. Shall I schedule it?
User: Yes
Bot: Meeting scheduled successfully!
```

## Technical Details

### LLM Configuration

- **Model**: GPT-4o-mini
- **Temperature**: 
  - Intent Classification: 0 (deterministic)
  - Meeting Extraction: 0.3 (slightly creative)
  - Question Answering: 0.7 (more creative)

### Timezone Handling

- **User Input**: Assumed to be in IST (Asia/Kolkata)
- **Storage**: All times converted to UTC
- **Display**: Formatted back to IST for user-friendly output
- **Business Hours**: 9 AM - 6 PM IST

### Error Handling

**Authentication Errors:**
- Falls back to manual JWT decoding
- Provides clear "please sign in" message

**Scheduling Errors:**
- Logs detailed error information
- Returns user-friendly error message
- Maintains conversation state for retry

**Parsing Errors:**
- Handles null/undefined values gracefully
- Asks clarifying questions for missing data

## File Structure

```
backend/src/langchain/
├── langchain.module.ts          # Module configuration
├── langchain.controller.ts      # API endpoint
├── conversational.service.ts    # Main orchestration logic
└── parsers/
    ├── intent.parser.ts         # Intent classification
    └── meeting.parser.ts        # Entity extraction

frontend/pages/
├── chat.tsx                     # Chat UI
└── _app.tsx                     # Auth token management
```

## Dependencies

**Backend:**
- `@langchain/openai`: LLM integration
- `@langchain/core`: Core LangChain functionality
- `@nestjs/common`: NestJS framework
- `axios`: HTTP client for Microsoft Graph

**Frontend:**
- `@azure/msal-react`: Microsoft authentication
- `axios`: API client
- `react`: UI framework

## Environment Variables

```env
# Backend
OPENAI_API_KEY=sk-...
AZURE_CLIENT_ID=...
AZURE_TENANT_ID=...
AZURE_CLIENT_SECRET=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_AZURE_CLIENT_ID=...
NEXT_PUBLIC_AZURE_TENANT_ID=...
```

## Future Enhancements

- [ ] Support for recurring meetings
- [ ] Meeting modification/cancellation
- [ ] Calendar view integration
- [ ] Multi-language support
- [ ] Voice input support
- [ ] Meeting templates
- [ ] Persistent session storage (Redis)
- [ ] Rich message formatting (markdown, buttons)
