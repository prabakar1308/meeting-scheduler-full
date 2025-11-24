# Testing REST API Endpoints - Thunder Client Guide

## Issue: Microsoft Graph API Permissions

The error you're seeing (`Authorization_RequestDenied - Insufficient privileges`) is related to **Microsoft Graph API permissions**, not your Thunder Client request format.

### Root Cause

Your backend is trying to access Microsoft Graph API to check calendar availability, but the Azure app registration doesn't have the required permissions.

---

## Two Solutions

### Option 1: Fix Azure Permissions (Recommended for Production)

#### Step 1: Add Required Permissions

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app: `meeting-poc` (App ID: `89329e19-f83e-4afc-8340-84bc21cec7d3`)
4. Click **API permissions**
5. Click **Add a permission**
6. Select **Microsoft Graph**
7. Choose **Application permissions**
8. Add these permissions:
   - `Calendars.Read`
   - `Calendars.ReadWrite`
   - `User.Read.All`

#### Step 2: Grant Admin Consent

1. After adding permissions, click **Grant admin consent for [Your Organization]**
2. Click **Yes** to confirm
3. Wait for status to show "Granted"

#### Step 3: Test Again

Your endpoint should now work!

---

### Option 2: Mock the Graph API (For Testing)

If you just want to test the endpoint without Azure setup, we can temporarily mock the Graph API responses.

#### Create Mock Service

Create `src/graph/graph.client.mock.ts`:

```typescript
export class MockGraphClient {
  async findMeetingTimes(organizer: string, attendees: any[], options: any) {
    // Return mock meeting time suggestions
    return {
      meetingTimeSuggestions: [
        {
          meetingTimeSlot: {
            start: { dateTime: '2025-11-25T14:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-11-25T15:00:00', timeZone: 'UTC' }
          },
          confidence: 100,
          organizerAvailability: 'free',
          attendeeAvailability: [{ availability: 'free' }]
        },
        {
          meetingTimeSlot: {
            start: { dateTime: '2025-11-25T15:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-11-25T16:00:00', timeZone: 'UTC' }
          },
          confidence: 90,
          organizerAvailability: 'free',
          attendeeAvailability: [{ availability: 'free' }]
        }
      ]
    };
  }

  async createEvent(organizer: string, event: any) {
    // Return mock created event
    return {
      id: 'mock-event-id-' + Date.now(),
      subject: event.subject,
      start: event.start,
      end: event.end,
      attendees: event.attendees
    };
  }
}
```

#### Update Module to Use Mock

Edit `src/graph/graph.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { GraphClient } from './graph.client';
import { MockGraphClient } from './graph.client.mock';

@Module({
  providers: [
    {
      provide: GraphClient,
      // Use mock for development, real client for production
      useClass: process.env.USE_MOCK_GRAPH === 'true' ? MockGraphClient : GraphClient,
    },
  ],
  exports: [GraphClient],
})
export class GraphModule {}
```

#### Enable Mock in .env

Add to `backend/.env`:

```env
USE_MOCK_GRAPH=true
```

#### Restart Server

```bash
npm run start:dev
```

---

## Correct Thunder Client Request Format

### Endpoint: POST /scheduling/suggest

**URL:**
```
http://localhost:4000/scheduling/suggest
```

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "organizer": "user@example.com",
  "attendees": [
    {
      "emailAddress": {
        "address": "alice@example.com",
        "name": "Alice"
      },
      "type": "Required"
    },
    {
      "emailAddress": {
        "address": "bob@example.com",
        "name": "Bob"
      },
      "type": "Optional"
    }
  ],
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

**Expected Response:**
```json
[
  {
    "rank": 1,
    "start": "2025-11-25T14:00:00",
    "end": "2025-11-25T15:00:00",
    "score": 0.95,
    "reason": "High availability and optimal time"
  },
  {
    "rank": 2,
    "start": "2025-11-25T15:00:00",
    "end": "2025-11-25T16:00:00",
    "score": 0.85,
    "reason": "Good availability"
  }
]
```

---

### Endpoint: POST /scheduling/schedule

**URL:**
```
http://localhost:4000/scheduling/schedule
```

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "organizer": "user@example.com",
  "attendees": [
    {
      "emailAddress": {
        "address": "alice@example.com",
        "name": "Alice"
      },
      "type": "Required"
    }
  ],
  "start": "2025-11-25T14:00:00Z",
  "end": "2025-11-25T15:00:00Z",
  "createIfFree": true
}
```

**Expected Response:**
```json
{
  "id": "event-id-123",
  "subject": "Meeting",
  "start": {
    "dateTime": "2025-11-25T14:00:00",
    "timeZone": "UTC"
  },
  "end": {
    "dateTime": "2025-11-25T15:00:00",
    "timeZone": "UTC"
  },
  "attendees": [...]
}
```

---

## Common Mistakes

### ❌ Wrong: Missing emailAddress wrapper
```json
{
  "attendees": ["alice@example.com"]  // WRONG!
}
```

### ✅ Correct: Proper attendee format
```json
{
  "attendees": [
    {
      "emailAddress": {
        "address": "alice@example.com"
      }
    }
  ]
}
```

### ❌ Wrong: Invalid date format
```json
{
  "start": "2025-11-25 14:00:00"  // WRONG!
}
```

### ✅ Correct: ISO 8601 format
```json
{
  "start": "2025-11-25T14:00:00Z"  // CORRECT!
}
```

---

## Thunder Client Collection

Save this as a Thunder Client collection for easy testing:

```json
{
  "client": "Thunder Client",
  "collectionName": "Meeting Scheduler API",
  "dateExported": "2025-11-24",
  "version": "1.1",
  "folders": [],
  "requests": [
    {
      "name": "Suggest Meeting Times",
      "method": "POST",
      "url": "http://localhost:4000/scheduling/suggest",
      "headers": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ],
      "body": {
        "type": "json",
        "raw": "{\n  \"organizer\": \"user@example.com\",\n  \"attendees\": [\n    {\n      \"emailAddress\": {\n        \"address\": \"alice@example.com\",\n        \"name\": \"Alice\"\n      },\n      \"type\": \"Required\"\n    }\n  ],\n  \"start\": \"2025-11-25T09:00:00Z\",\n  \"end\": \"2025-11-25T17:00:00Z\"\n}"
      }
    },
    {
      "name": "Schedule Meeting",
      "method": "POST",
      "url": "http://localhost:4000/scheduling/schedule",
      "headers": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ],
      "body": {
        "type": "json",
        "raw": "{\n  \"organizer\": \"user@example.com\",\n  \"attendees\": [\n    {\n      \"emailAddress\": {\n        \"address\": \"alice@example.com\",\n        \"name\": \"Alice\"\n      },\n      \"type\": \"Required\"\n    }\n  ],\n  \"start\": \"2025-11-25T14:00:00Z\",\n  \"end\": \"2025-11-25T15:00:00Z\"\n}"
      }
    }
  ]
}
```

---

## Quick Fix Summary

**Immediate solution (for testing):**
1. Add `USE_MOCK_GRAPH=true` to `.env`
2. Create the mock Graph client file
3. Update Graph module to use mock
4. Restart server
5. Test with Thunder Client

**Production solution:**
1. Go to Azure Portal
2. Add required Graph API permissions
3. Grant admin consent
4. Test with Thunder Client

---

## Troubleshooting

### Still getting 403?
- Check if `USE_MOCK_GRAPH=true` is in `.env`
- Restart the server after adding env variable
- Verify mock file is created correctly

### Getting 400 Bad Request?
- Check request body format matches examples above
- Ensure `Content-Type: application/json` header is set
- Validate ISO 8601 date format

### Getting 500 Internal Server Error?
- Check server logs: `npm run start:dev`
- Verify database is running: `npx prisma studio`
- Check all environment variables are set
