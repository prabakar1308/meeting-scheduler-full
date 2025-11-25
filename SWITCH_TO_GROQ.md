# Quick Start: Switch to Groq (Free)

## Problem
❌ **OpenAI Error**: `429 You exceeded your current quota`

## Solution
✅ **Use Groq** - Free, fast, open-source models

## Steps to Fix

### 1. Get Groq API Key (2 minutes)

1. Visit: https://console.groq.com
2. Sign up (free)
3. Go to "API Keys"
4. Click "Create API Key"
5. Copy the key (starts with `gsk_...`)

### 2. Update Environment Variables

Edit `backend/.env`:

```env
# Comment out OpenAI
# OPENAI_API_KEY=sk-...

# Add Groq (FREE!)
GROQ_API_KEY=gsk_your_key_here
```

### 3. Install Groq Package

```bash
cd backend
npm install @langchain/groq --legacy-peer-deps
```

### 4. Restart Backend

```bash
# Stop current server (Ctrl+C)
npm run start:dev
```

## What Changed

All LLM calls now use Groq instead of OpenAI:

| Component | Old Model | New Model | Cost |
|-----------|-----------|-----------|------|
| Intent Classification | GPT-4o-mini | Llama 3.1 8B | FREE |
| Meeting Extraction | GPT-4o-mini | Llama 3.1 70B | FREE |
| AI Agent | GPT-4o | Llama 3.1 70B | FREE |

## Files Updated

✅ `backend/src/langchain/parsers/intent.parser.ts`
✅ `backend/src/langchain/parsers/meeting.parser.ts`
✅ `backend/src/langchain/mcp-agent.service.ts`

## Test It

After adding the API key and restarting:

1. Go to `http://localhost:3000/chat`
2. Send: "Schedule a meeting tomorrow"
3. Should work with Groq!

## Groq Models Used

- **llama-3.1-8b-instant** - Intent classification (fast)
- **llama-3.1-70b-versatile** - Entity extraction & agent (accurate)

## Benefits

✅ **FREE** - No cost
✅ **FAST** - 500+ tokens/second
✅ **UNLIMITED** - Much higher limits than OpenAI free tier
✅ **OPEN SOURCE** - Llama models

## Troubleshooting

**"Cannot find module '@langchain/groq'"**
- Run: `npm install @langchain/groq --legacy-peer-deps`
- Restart backend

**"Invalid API key"**
- Check key starts with `gsk_`
- Verify it's in `.env` file
- Restart backend server

**Still getting OpenAI error**
- Make sure `GROQ_API_KEY` is set
- Comment out `OPENAI_API_KEY`
- Clear any cached environment variables

## Next Steps

1. ✅ Get Groq API key
2. ✅ Add to `.env`
3. ⏳ Install package (running...)
4. ⏳ Restart backend
5. ⏳ Test chat interface

That's it! You're now using free, fast, open-source AI models! 🚀
