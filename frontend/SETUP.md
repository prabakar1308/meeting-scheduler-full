# Frontend Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env.local` file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Azure credentials:

```env
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-client-id
NEXT_PUBLIC_AZURE_TENANT_ID=your-azure-tenant-id
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Configure Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations** → Your app
3. Click **Authentication** → **Add a platform** → **Single-page application**
4. Add redirect URI: `http://localhost:3000`
5. Enable **Access tokens** and **ID tokens**
6. Save

### 4. Run the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

✅ **Azure AD Authentication** - Sign in with Microsoft account  
✅ **Meeting Scheduling** - Add attendees and select dates  
✅ **AI Suggestions** - Get intelligent meeting time recommendations  
✅ **One-Click Booking** - Schedule meetings instantly  
✅ **Responsive Design** - Works on desktop and mobile  

---

## Project Structure

```
frontend/
├── pages/
│   ├── _app.tsx          # MSAL Provider wrapper
│   ├── index.tsx         # Home page
│   └── schedule.tsx      # Meeting scheduler
├── components/
│   ├── Layout.tsx        # Navigation and layout
│   └── MeetingForm.tsx   # Meeting scheduling form
├── lib/
│   ├── msalConfig.ts     # Azure AD configuration
│   └── api.ts            # Backend API client
└── styles/
    └── globals.css       # Global styles
```

---

## Usage

### 1. Sign In

Click **"Sign in with Microsoft"** in the navigation bar.

### 2. Schedule a Meeting

1. Go to **Schedule Meeting** page
2. Add attendee email addresses
3. Select date range
4. Click **"Get Meeting Suggestions"**
5. Review AI-powered suggestions
6. Click **"Schedule"** on your preferred time

### 3. View Meetings

Scheduled meetings will appear in your Microsoft Outlook calendar.

---

## Troubleshooting

### "Login failed" error

**Solution:**
- Verify `NEXT_PUBLIC_AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_TENANT_ID` are correct
- Check redirect URI is added in Azure Portal
- Ensure you're using the same Azure app as the backend

### "Failed to get suggestions" error

**Solution:**
- Verify backend is running on `http://localhost:4000`
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure backend has required Azure permissions

### CORS errors

**Solution:**
- Backend should allow `http://localhost:3000` origin
- Check backend CORS configuration in `main.ts`

---

## Development

### Running Both Backend and Frontend

**Terminal 1 (Backend):**
```bash
cd backend
npm run start:dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

**Terminal 3 (Prisma Studio - Optional):**
```bash
cd backend
npx prisma studio
```

---

## Production Deployment

### Environment Variables

Update `.env.local` for production:

```env
NEXT_PUBLIC_AZURE_CLIENT_ID=your-prod-client-id
NEXT_PUBLIC_AZURE_TENANT_ID=your-tenant-id
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### Azure Configuration

Add production redirect URI in Azure Portal:
- `https://your-domain.com`

### Build and Deploy

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
vercel deploy
```

---

## Summary

Your frontend is now ready! 🎉

**Next steps:**
1. Copy `.env.local.example` to `.env.local`
2. Add your Azure credentials
3. Add redirect URI in Azure Portal
4. Run `npm run dev`
5. Open http://localhost:3000
6. Sign in and start scheduling meetings!
