# Switching to Groq (Free Open-Source Models)

## Issue
You've exceeded your OpenAI API quota. The error `429 You exceeded your current quota` means you've hit your usage limit.

## Solution: Use Groq

Groq provides **free** access to open-source models with extremely fast inference:
- **Llama 3.1 70B** - Most capable
- **Llama 3.1 8B** - Fast and efficient
- **Mixtral 8x7B** - Good balance

## Setup Steps

### 1. Get Groq API Key (Free)

1. Visit https://console.groq.com
2. Sign up for a free account
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `gsk_...`)

### 2. Add to Environment Variables

**Backend `.env`:**
```env
# Comment out or remove OpenAI key
# OPENAI_API_KEY=sk-...

# Add Groq key
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 3. Update Code

The code has been updated to use Groq instead of OpenAI:

**Files Modified:**
- `backend/src/langchain/parsers/intent.parser.ts`
- `backend/src/langchain/parsers/meeting.parser.ts`
- `backend/src/langchain/mcp-agent.service.ts`

**Changes:**
```typescript
// Before (OpenAI)
import { ChatOpenAI } from '@langchain/openai';
const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    openAIApiKey: process.env.OPENAI_API_KEY,
});

// After (Groq)
import { ChatGroq } from '@langchain/groq';
const model = new ChatGroq({
    modelName: 'llama-3.1-70b-versatile',
    apiKey: process.env.GROQ_API_KEY,
});
```

## Available Groq Models

### Recommended Models

1. **llama-3.1-70b-versatile** (Best quality)
   - Most capable
   - Best for complex tasks
   - Slower but more accurate

2. **llama-3.1-8b-instant** (Fastest)
   - Very fast responses
   - Good for simple tasks
   - Lower quality than 70B

3. **mixtral-8x7b-32768** (Balanced)
   - Good balance of speed and quality
   - Large context window (32k tokens)

### Model Selection Guide

**For Intent Classification:**
- Use: `llama-3.1-8b-instant`
- Reason: Simple classification task, speed matters

**For Meeting Data Extraction:**
- Use: `llama-3.1-70b-versatile`
- Reason: Complex entity extraction, accuracy matters

**For Agent Chat:**
- Use: `llama-3.1-70b-versatile`
- Reason: Conversational quality matters

## Benefits of Groq

✅ **Free Tier** - Generous free usage
✅ **Fast** - Extremely fast inference (up to 500 tokens/sec)
✅ **Open Source** - Llama, Mixtral models
✅ **No Quota Issues** - Much higher limits
✅ **Same API** - Works with LangChain

## Cost Comparison

| Provider | Model | Cost | Speed |
|----------|-------|------|-------|
| OpenAI | GPT-4o | $5/$15 per 1M tokens | Medium |
| OpenAI | GPT-4o-mini | $0.15/$0.60 per 1M tokens | Fast |
| **Groq** | **Llama 3.1 70B** | **FREE** | **Very Fast** |
| **Groq** | **Llama 3.1 8B** | **FREE** | **Extremely Fast** |

## Testing

After updating the `.env` file and restarting the backend:

```bash
# Test intent classification
curl -X POST http://localhost:4000/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sessionId": "test",
    "message": "Schedule a meeting tomorrow"
  }'
```

## Fallback Strategy

You can also implement a fallback:

```typescript
const model = process.env.GROQ_API_KEY
    ? new ChatGroq({
        modelName: 'llama-3.1-70b-versatile',
        apiKey: process.env.GROQ_API_KEY,
    })
    : new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        openAIApiKey: process.env.OPENAI_API_KEY,
    });
```

## Next Steps

1. ✅ Install `@langchain/groq` package
2. ⏳ Get Groq API key from https://console.groq.com
3. ⏳ Add `GROQ_API_KEY` to `.env`
4. ⏳ Restart backend server
5. ⏳ Test the chat interface

## Troubleshooting

**Error: "Invalid API key"**
- Check that key starts with `gsk_`
- Verify it's in the `.env` file
- Restart the backend

**Error: "Model not found"**
- Use exact model names from Groq docs
- Try `llama-3.1-70b-versatile` or `llama-3.1-8b-instant`

**Slow responses**
- Switch to `llama-3.1-8b-instant` for faster responses
- Groq is usually very fast, check network

## Alternative: Use Both

You can use Groq for most tasks and OpenAI for critical ones:

```typescript
// Fast tasks - use Groq
const intentModel = new ChatGroq({
    modelName: 'llama-3.1-8b-instant',
    apiKey: process.env.GROQ_API_KEY,
});

// Complex tasks - use OpenAI (if you have credits)
const agentModel = new ChatOpenAI({
    modelName: 'gpt-4o',
    openAIApiKey: process.env.OPENAI_API_KEY,
});
```
