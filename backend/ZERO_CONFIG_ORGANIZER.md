# Dynamic Organizer - Zero Configuration Required! 🎉

## Quick Start

**No environment variables needed!** The system automatically fetches the organizer from Microsoft Graph API.

Just make API requests without the `organizer` field:

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

The system will:
1. ✅ Fetch the first user from your Azure organization
2. ✅ Use that user's email as the organizer
3. ✅ Log which user is being used

---

## How It Works

### Automatic Detection Flow

```
Request has organizer field?
  ├─ Yes → Use provided organizer
  └─ No → Fetch from Microsoft Graph API
      ├─ DEFAULT_ORGANIZER_USER_ID set?
      │   ├─ Yes → Get that specific user
      │   └─ No → Get first user in organization ✅ (Default)
      └─ Graph API failed?
          └─ Use DEFAULT_ORGANIZER_EMAIL (if set)
```

---

## Configuration Options

### ✅ Option 1: Zero Configuration (Recommended)

**No setup needed!** Just ensure your Azure credentials are configured:

```env
# Only these are required:
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

**What happens:**
- System fetches first user from your organization
- Uses that user's email automatically
- Perfect for testing and development

**Server logs:**
```
[GraphClient] Using first available user as organizer: john.doe@contoso.com
[SchedulingService] Using authenticated user as organizer: john.doe@contoso.com
```

### Option 2: Specific User (Optional)

For production or multi-user scenarios, specify a user:

```env
DEFAULT_ORGANIZER_USER_ID=scheduler@yourdomain.com
```

### Option 3: Fallback Email (Optional)

Safety net if Graph API is unavailable:

```env
DEFAULT_ORGANIZER_EMAIL=admin@yourdomain.com
```

---

## Usage Examples

### Minimal Request (Zero Config)

**URL:** `POST http://localhost:4000/scheduling/suggest`

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

**What happens:**
- System calls Microsoft Graph API
- Fetches first user automatically
- Uses their email as organizer
- No configuration needed!

### Override with Custom Organizer (Optional)

**Body:**
```json
{
  "organizer": "manager@example.com",
  "attendees": [...],
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T17:00:00Z"
}
```

---

## Required Azure Permissions

Ensure your Azure app has:

- ✅ `User.Read.All` - To read user information
- ✅ `Calendars.Read` - To read calendars
- ✅ `Calendars.ReadWrite` - To create meetings

**Already configured if you followed the Azure setup!**

---

## Benefits

✅ **Zero Configuration** - Works out of the box  
✅ **Intelligent** - Automatically detects organizer  
✅ **Flexible** - Can override per request  
✅ **Resilient** - Falls back gracefully on errors  
✅ **Transparent** - Logs which organizer is used  
✅ **Secure** - Uses Azure AD authentication  

---

## Comparison

### Before (Manual Configuration)

```env
DEFAULT_ORGANIZER_EMAIL=admin@contoso.com  # Required
```

```json
{
  "organizer": "admin@contoso.com",  // Had to include
  "attendees": [...]
}
```

### After (Automatic Detection)

```env
# No configuration needed!
```

```json
{
  // No organizer field needed!
  "attendees": [...]
}
```

---

## Advanced: Specific User Configuration

If you want to use a specific user instead of auto-detection:

### Step 1: Find User ID

```bash
# Using Azure CLI
az ad user show --id user@yourdomain.com --query id
```

Or use the email directly:
```env
DEFAULT_ORGANIZER_USER_ID=user@yourdomain.com
```

### Step 2: Add to .env

```env
DEFAULT_ORGANIZER_USER_ID=user@yourdomain.com
```

### Step 3: Restart Server

```bash
npm run start:dev
```

Now all requests will use that specific user as organizer.

---

## Troubleshooting

### No Users Found

**Error:** `No users found in organization`

**Solution:**
- Ensure your Azure organization has at least one user
- Check Azure permissions are granted
- Or set `DEFAULT_ORGANIZER_EMAIL` as fallback

### Permission Denied

**Error:** `Authorization_RequestDenied`

**Solution:**
- Add `User.Read.All` permission in Azure Portal
- Grant admin consent
- Wait 5-10 minutes for propagation

### Graph API Unavailable

**Error:** `Failed to fetch authenticated user from Graph API`

**Solution:**
- System will automatically fall back to `DEFAULT_ORGANIZER_EMAIL` if set
- Or add `DEFAULT_ORGANIZER_EMAIL` to `.env` for resilience

---

## Summary

**The system now works with ZERO configuration!**

1. ✅ No environment variables required
2. ✅ Automatically fetches organizer from Azure
3. ✅ Falls back gracefully on errors
4. ✅ Can override per request
5. ✅ Backward compatible

Just make your API requests without the `organizer` field and let the system handle it automatically! 🚀
