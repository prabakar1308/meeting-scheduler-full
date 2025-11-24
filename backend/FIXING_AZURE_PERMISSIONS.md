# Fixing Azure Graph API Permissions - Step by Step

## Current Error

```
Authorization_RequestDenied
Insufficient privileges to complete the operation.
```

**What this means:** Your Azure credentials are valid, but your app doesn't have permission to access Microsoft Graph Calendar APIs.

---

## Solution: Add Required Permissions in Azure Portal

### Step 1: Open Azure Portal

1. Go to [https://portal.azure.com](https://portal.azure.com)
2. Sign in with your Azure account

### Step 2: Navigate to Your App Registration

1. In the search bar at the top, type **"App registrations"**
2. Click on **App registrations** from the results
3. Find and click on your app: **meeting-poc**
   - App ID: `89329e19-f83e-4afc-8340-84bc21cec7d3`

### Step 3: Add API Permissions

1. In the left sidebar, click **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions** (NOT Delegated permissions)
5. Search for and add these permissions:
   - ✅ `Calendars.Read` - Read calendars in all mailboxes
   - ✅ `Calendars.ReadWrite` - Read and write calendars in all mailboxes
   - ✅ `User.Read.All` - Read all users' full profiles

### Step 4: Grant Admin Consent (CRITICAL!)

⚠️ **This is the most important step!**

1. After adding the permissions, you'll see them listed with status "Not granted"
2. Click the button **"Grant admin consent for [Your Organization]"**
3. Click **Yes** in the confirmation dialog
4. Wait for the status to change to **"Granted for [Your Organization]"** with a green checkmark

### Step 5: Verify Permissions

Your permissions should look like this:

| API / Permission name | Type | Status |
|----------------------|------|--------|
| Microsoft Graph / Calendars.Read | Application | ✅ Granted |
| Microsoft Graph / Calendars.ReadWrite | Application | ✅ Granted |
| Microsoft Graph / User.Read.All | Application | ✅ Granted |

---

## Alternative: Use Mock Graph Client (For Testing)

If you can't get Azure permissions right now, use a mock client for testing:

### Option A: Quick Mock Setup

1. **Add to your `.env` file:**
```env
USE_MOCK_GRAPH=true
```

2. **Create `backend/src/graph/graph.client.mock.ts`:**

```typescript
export class MockGraphClient {
  async findMeetingTimes(organizer: string, attendees: any[], options: any) {
    console.log('🎭 Using MOCK Graph Client');
    console.log('Finding meeting times for:', organizer, 'with', attendees.length, 'attendees');
    
    // Return realistic mock data
    return {
      '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#microsoft.graph.meetingTimeSuggestionsResult',
      emptySuggestionsReason: '',
      meetingTimeSuggestions: [
        {
          confidence: 100,
          organizerAvailability: 'free',
          suggestionReason: 'Suggested because it is one of the nearest times when all attendees are available.',
          meetingTimeSlot: {
            start: {
              dateTime: '2025-11-25T14:00:00.0000000',
              timeZone: 'UTC'
            },
            end: {
              dateTime: '2025-11-25T15:00:00.0000000',
              timeZone: 'UTC'
            }
          },
          attendeeAvailability: attendees.map(() => ({
            availability: 'free',
            attendee: { emailAddress: { address: '' } }
          }))
        },
        {
          confidence: 90,
          organizerAvailability: 'free',
          suggestionReason: 'Good availability for all attendees.',
          meetingTimeSlot: {
            start: {
              dateTime: '2025-11-25T15:00:00.0000000',
              timeZone: 'UTC'
            },
            end: {
              dateTime: '2025-11-25T16:00:00.0000000',
              timeZone: 'UTC'
            }
          },
          attendeeAvailability: attendees.map(() => ({
            availability: 'free',
            attendee: { emailAddress: { address: '' } }
          }))
        },
        {
          confidence: 75,
          organizerAvailability: 'free',
          suggestionReason: 'Available time slot.',
          meetingTimeSlot: {
            start: {
              dateTime: '2025-11-25T10:00:00.0000000',
              timeZone: 'UTC'
            },
            end: {
              dateTime: '2025-11-25T11:00:00.0000000',
              timeZone: 'UTC'
            }
          },
          attendeeAvailability: attendees.map(() => ({
            availability: 'free',
            attendee: { emailAddress: { address: '' } }
          }))
        }
      ]
    };
  }

  async createEvent(organizer: string, event: any) {
    console.log('🎭 Using MOCK Graph Client');
    console.log('Creating event for:', organizer);
    
    return {
      '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users(\'user\')/events/$entity',
      '@odata.etag': 'W/"mock-etag"',
      id: 'mock-event-' + Date.now(),
      createdDateTime: new Date().toISOString(),
      lastModifiedDateTime: new Date().toISOString(),
      subject: event.subject || 'Meeting',
      bodyPreview: '',
      body: {
        contentType: 'HTML',
        content: event.body?.content || ''
      },
      start: event.start,
      end: event.end,
      location: event.location || { displayName: '' },
      attendees: event.attendees || [],
      organizer: {
        emailAddress: {
          name: organizer,
          address: organizer
        }
      }
    };
  }

  async getAccessToken(userEmail: string): Promise<string> {
    console.log('🎭 Using MOCK Graph Client - returning mock token');
    return 'mock-access-token-' + Date.now();
  }
}
```

3. **Update `backend/src/graph/graph.module.ts`:**

```typescript
import { Module } from '@nestjs/common';
import { GraphClient } from './graph.client';
import { MockGraphClient } from './graph.client.mock';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: GraphClient,
      useClass: process.env.USE_MOCK_GRAPH === 'true' 
        ? MockGraphClient 
        : GraphClient,
    },
  ],
  exports: [GraphClient],
})
export class GraphModule {}
```

4. **Restart your server:**
```bash
# Stop the current server (Ctrl+C)
npm run start:dev
```

5. **Test again in Thunder Client**

You should now see `🎭 Using MOCK Graph Client` in your server logs and the API will return mock data.

---

## Testing After Fix

### Thunder Client Request

**URL:** `POST http://localhost:4000/scheduling/suggest`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
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
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

**Expected Success Response (200 OK):**
```json
[
  {
    "rank": 1,
    "start": "2025-11-25T14:00:00.0000000",
    "end": "2025-11-25T15:00:00.0000000",
    "score": 0.95,
    "reason": "High confidence - all attendees available"
  },
  {
    "rank": 2,
    "start": "2025-11-25T15:00:00.0000000",
    "end": "2025-11-25T16:00:00.0000000",
    "score": 0.85,
    "reason": "Good availability"
  }
]
```

---

## Troubleshooting

### Still getting 403 after adding permissions?

1. **Did you grant admin consent?** This is required!
2. **Wait 5-10 minutes** - Azure permission changes can take time to propagate
3. **Restart your backend server** - Clear the token cache
4. **Check token expiry** - Tokens are cached for 1 hour

### Using Mock but still getting errors?

1. Verify `.env` has `USE_MOCK_GRAPH=true`
2. Check that `graph.client.mock.ts` file exists
3. Restart the server completely
4. Check server logs for `🎭 Using MOCK Graph Client` message

### Getting different errors?

Check server logs:
```bash
npm run start:dev
```

Look for error messages and share them for further help.

---

## Summary

**Quick Fix (Testing):**
- Add `USE_MOCK_GRAPH=true` to `.env`
- Create mock Graph client file
- Update Graph module
- Restart server

**Production Fix:**
- Go to Azure Portal
- Add Calendar permissions to your app
- **Grant admin consent** ⚠️ (Don't skip this!)
- Wait 5-10 minutes
- Restart server
- Test again
