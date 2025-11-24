# User Authentication Implementation Guide

## Overview

This guide explains how to capture the **signed-in user's email** instead of using Azure app credentials. This requires implementing **user-delegated authentication** with Azure AD.

---

## Architecture Comparison

### Current: App-Only Authentication
```
Client → API → Azure App Credentials → Graph API → Any user in org
```
- Uses client credentials (app ID + secret)
- No user context
- Can access any user's data

### New: User-Delegated Authentication
```
User → Login → Access Token → API (with token) → Graph API → Signed-in user's data
```
- User logs in with their credentials
- API receives user's access token
- Can only access that user's data

---

## Implementation Steps

### Step 1: Update Azure App Registration

#### 1.1 Add Delegated Permissions

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations** → Your app
3. Click **API permissions**
4. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
5. Add these permissions:
   - `User.Read` - Read signed-in user's profile
   - `Calendars.ReadWrite` - Read/write signed-in user's calendar
   - `offline_access` - Maintain access to data
6. Click **Grant admin consent**

#### 1.2 Add Redirect URI

1. Go to **Authentication**
2. Click **Add a platform** → **Web**
3. Add redirect URI:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`
4. Enable **Access tokens** and **ID tokens**
5. Save

### Step 2: Install Required Packages

```bash
cd backend
npm install passport passport-azure-ad express-session
npm install --save-dev @types/passport @types/express-session
```

### Step 3: Create Authentication Strategy

Create `src/auth/azure-ad.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BearerStrategy } from 'passport-azure-ad';

@Injectable()
export class AzureADStrategy extends PassportStrategy(BearerStrategy, 'azure-ad') {
  constructor() {
    super({
      identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
      clientID: process.env.AZURE_CLIENT_ID,
      validateIssuer: true,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
      passReqToCallback: false,
      scope: ['User.Read', 'Calendars.ReadWrite'],
    });
  }

  async validate(payload: any) {
    // payload contains the decoded JWT token
    return {
      userId: payload.oid,
      email: payload.preferred_username || payload.email,
      name: payload.name,
    };
  }
}
```

### Step 4: Create Auth Guard

Create `src/auth/azure-ad.guard.ts`:

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AzureADGuard extends AuthGuard('azure-ad') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}
```

### Step 5: Update Auth Module

Update `src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AzureADStrategy } from './azure-ad.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'azure-ad' })],
  providers: [AuthService, AzureADStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### Step 6: Update Scheduling Controller

Update `src/scheduling/scheduling.controller.ts`:

```typescript
import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SuggestRequestDTO, ScheduleRequestDTO } from './types';
import { AzureADGuard } from '../auth/azure-ad.guard';

@Controller('scheduling')
@UseGuards(AzureADGuard) // Protect all endpoints
export class SchedulingController {
  constructor(private svc: SchedulingService) {}

  @Post('suggest')
  async suggest(@Body() dto: SuggestRequestDTO, @Request() req) {
    // Get signed-in user's email from JWT token
    const userEmail = req.user.email;
    return this.svc.suggestSlots({ ...dto, organizer: userEmail });
  }

  @Post('schedule')
  async schedule(@Body() dto: ScheduleRequestDTO, @Request() req) {
    // Get signed-in user's email from JWT token
    const userEmail = req.user.email;
    return this.svc.scheduleMeeting({ ...dto, organizer: userEmail });
  }
}
```

### Step 7: Update Graph Client for User Tokens

Update `src/graph/graph.client.ts` to support user tokens:

```typescript
async withUserAuthHeaders(userToken: string) {
  return { Authorization: `Bearer ${userToken}` };
}

async findMeetingTimesForUser(userToken: string, attendees: any[], options: any) {
  const headers = await this.withUserAuthHeaders(userToken);
  const resp = await this.requestWithRetry(() => 
    this.client.post('/me/findMeetingTimes', options, { headers })
  );
  return resp.data;
}

async createEventForCurrentUser(userToken: string, eventPayload: any) {
  const headers = await this.withUserAuthHeaders(userToken);
  const resp = await this.requestWithRetry(() => 
    this.client.post('/me/events', eventPayload, { headers })
  );
  return resp.data;
}
```

---

## Frontend Integration

### React/Next.js Example

```typescript
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'YOUR_AZURE_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: 'http://localhost:3000/auth/callback',
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

// Login
async function login() {
  const loginResponse = await msalInstance.loginPopup({
    scopes: ['User.Read', 'Calendars.ReadWrite'],
  });
  
  const accessToken = loginResponse.accessToken;
  localStorage.setItem('accessToken', accessToken);
}

// Make API call with token
async function suggestMeetings() {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:4000/scheduling/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // User's token
    },
    body: JSON.stringify({
      attendees: [{ emailAddress: { address: 'alice@example.com' } }],
      start: '2025-11-25T09:00:00Z',
      end: '2025-11-25T17:00:00Z',
    }),
  });
  
  return response.json();
}
```

---

## Testing with Postman/Thunder Client

### Step 1: Get User Access Token

**Option A: Using Azure CLI**
```bash
az login
az account get-access-token --resource https://graph.microsoft.com
```

**Option B: Using MSAL Playground**
1. Go to https://aka.ms/msal-playground
2. Login with your account
3. Copy the access token

### Step 2: Make API Request

**URL:** `POST http://localhost:4000/scheduling/suggest`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_USER_ACCESS_TOKEN
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

The API will automatically use the signed-in user's email from the token!

---

## Environment Variables

Update `.env`:

```env
# Azure AD Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Optional: Redirect URI for OAuth flow
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback
```

---

## Benefits

✅ **User Context**: Each request uses the actual signed-in user  
✅ **Security**: Users can only access their own data  
✅ **Audit Trail**: Know exactly who made each request  
✅ **Permissions**: Respects user's actual permissions  
✅ **Multi-tenant**: Works for any user in your organization  

---

## Comparison

### Before (App-Only)
```
API uses app credentials → Can access any user's calendar
```

### After (User-Delegated)
```
User logs in → API uses user's token → Can only access that user's calendar
```

---

## Migration Path

### Phase 1: Support Both (Recommended)

```typescript
@Post('suggest')
async suggest(@Body() dto: SuggestRequestDTO, @Request() req) {
  // If user is authenticated, use their email
  const userEmail = req.user?.email;
  
  // Otherwise fall back to auto-detection
  return this.svc.suggestSlots({ ...dto, organizer: userEmail });
}
```

### Phase 2: Require Authentication

```typescript
@Controller('scheduling')
@UseGuards(AzureADGuard) // All endpoints require auth
export class SchedulingController {
  // ...
}
```

---

## Troubleshooting

### Token Validation Failed

**Error:** `Unauthorized` or `Invalid token`

**Solution:**
- Ensure token is for correct tenant
- Check token hasn't expired
- Verify audience matches your client ID

### Missing Email in Token

**Error:** `req.user.email is undefined`

**Solution:**
- Add `email` scope to token request
- Check user has email in Azure AD profile
- Use `preferred_username` as fallback

---

## Summary

To capture signed-in user's email:

1. ✅ Add delegated permissions in Azure
2. ✅ Install passport packages
3. ✅ Create Azure AD strategy
4. ✅ Add auth guard to controllers
5. ✅ Extract email from JWT token
6. ✅ Frontend: Login and send token with requests

The API will now use the **actual signed-in user's email** instead of Azure app credentials!
