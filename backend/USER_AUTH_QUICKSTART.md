# User Authentication - Quick Start Guide

## ✅ Implementation Complete!

User authentication has been implemented. The API now supports **three ways** to determine the organizer:

### Priority Order:
1. **Authenticated User** (from JWT token) - Highest priority
2. **Request Body** (explicit organizer field)
3. **Auto-Detection** (from Microsoft Graph API)

---

## How to Use

### Option 1: With User Authentication (Recommended)

**Step 1: Get User Access Token**

Using Azure CLI:
```bash
az login
az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv
```

**Step 2: Make API Request with Token**

**Thunder Client/Postman:**
```
POST http://localhost:4000/scheduling/suggest

Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_USER_ACCESS_TOKEN

Body:
{
  "attendees": [
    {
      "emailAddress": {
        "address": "alice@example.com"
      }
    }
  ],
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

**Result:** Uses the signed-in user's email from the JWT token!

### Option 2: Without Authentication (Backward Compatible)

**Thunder Client/Postman:**
```
POST http://localhost:4000/scheduling/suggest

Headers:
  Content-Type: application/json

Body:
{
  "attendees": [
    {
      "emailAddress": {
        "address": "alice@example.com"
      }
    }
  ],
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

**Result:** Auto-detects organizer from Microsoft Graph API (first user in organization)

### Option 3: Explicit Organizer (Override)

```json
{
  "organizer": "manager@example.com",
  "attendees": [...],
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

**Result:** Uses the specified organizer, regardless of authentication

---

## Testing

### Test 1: Get Your Access Token

```bash
# Login to Azure
az login

# Get access token
az account get-access-token --resource https://graph.microsoft.com
```

Copy the `accessToken` value.

### Test 2: Call API with Token

In Thunder Client:

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json
```

**Body:**
```json
{
  "attendees": [
    {
      "emailAddress": {
        "address": "alice@example.com"
      }
    }
  ],
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

Check server logs - you should see:
```
[SchedulingService] Using authenticated user as organizer: your-email@domain.com
```

---

## Frontend Integration

### React/Next.js Example

```typescript
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

// Login function
export async function loginUser() {
  try {
    const response = await msalInstance.loginPopup({
      scopes: ['User.Read', 'Calendars.ReadWrite'],
    });
    
    return response.accessToken;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// API call with user token
export async function suggestMeetings(token: string) {
  const response = await fetch('http://localhost:4000/scheduling/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // User's token
    },
    body: JSON.stringify({
      attendees: [
        {
          emailAddress: {
            address: 'alice@example.com',
          },
        },
      ],
      start: '2025-11-25T09:00:00Z',
      end: '2025-11-25T17:00:00Z',
    }),
  });
  
  return response.json();
}

// Usage in component
function ScheduleMeetingComponent() {
  const handleSchedule = async () => {
    // 1. Login user
    const token = await loginUser();
    
    // 2. Call API with token
    const result = await suggestMeetings(token);
    
    console.log('Suggestions:', result);
  };
  
  return <button onClick={handleSchedule}>Schedule Meeting</button>;
}
```

---

## Azure Configuration Required

### Add Delegated Permissions

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations** → Your app
3. Click **API permissions** → **Add a permission**
4. Select **Microsoft Graph** → **Delegated permissions**
5. Add:
   - `User.Read`
   - `Calendars.ReadWrite`
   - `offline_access`
6. Click **Grant admin consent**

### Add Redirect URI (for frontend)

1. Go to **Authentication**
2. Click **Add a platform** → **Single-page application**
3. Add redirect URI: `http://localhost:3000` (or your frontend URL)
4. Enable **Access tokens** and **ID tokens**
5. Save

---

## How It Works

### Authentication Flow

```
1. User logs in via frontend (MSAL)
   ↓
2. Azure AD returns JWT access token
   ↓
3. Frontend sends token in Authorization header
   ↓
4. Backend validates JWT signature using Azure's public keys
   ↓
5. Backend extracts user email from token payload
   ↓
6. API uses that email as organizer
```

### Token Validation

The backend:
- ✅ Validates JWT signature using Azure AD's public keys
- ✅ Checks token issuer and audience
- ✅ Extracts user email from `preferred_username` or `email` claim
- ✅ Makes user info available in `req.user`

---

## Benefits

✅ **Secure**: Only authenticated users can access their own data  
✅ **User Context**: Each request uses the actual signed-in user  
✅ **Backward Compatible**: Works with or without authentication  
✅ **Flexible**: Can still override organizer if needed  
✅ **Audit Trail**: Know exactly who made each request  

---

## Troubleshooting

### "Authentication required" error

**Cause:** Using required auth guard instead of optional

**Solution:** Controller uses `OptionalAzureADGuard` - authentication is optional

### Token validation failed

**Cause:** Invalid or expired token

**Solution:**
- Get a fresh token using `az account get-access-token`
- Ensure token is for correct tenant
- Check token hasn't expired (tokens expire after 1 hour)

### Email not found in token

**Cause:** Token doesn't include email claim

**Solution:**
- Add `email` scope when requesting token
- Check user has email in Azure AD profile
- Strategy falls back to `preferred_username` or `upn`

---

## Summary

**Three ways to determine organizer (in priority order):**

1. **JWT Token** → `req.user.email` (if authenticated)
2. **Request Body** → `dto.organizer` (if provided)
3. **Auto-Detection** → Graph API (fallback)

**Backward compatible:** Existing requests without authentication continue to work!

**To use authentication:** Just add `Authorization: Bearer <token>` header to your requests.
