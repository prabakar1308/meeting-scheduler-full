# Multi-Modal LLM Provider

## Overview

The application now supports **both OpenAI and Groq** with automatic provider selection!

## How It Works

### Automatic Provider Selection

The `LLMProvider` class automatically chooses the best available provider:

1. **Priority**: Groq (free) > OpenAI (paid)
2. **Fallback**: If Groq key not available, uses OpenAI
3. **Error**: If neither key is available, throws helpful error

### Usage

```typescript
import { LLMProvider } from './providers/llm.provider';

// Automatically selects best provider
const model = LLMProvider.createChatModel({
    task: 'intent',      // or 'extraction', 'agent', 'general'
    temperature: 0
});
```

## Configuration

### Option 1: Groq Only (FREE)
```env
GROQ_API_KEY=gsk_your_groq_key
```

### Option 2: OpenAI Only (PAID)
```env
OPENAI_API_KEY=sk_your_openai_key
```

### Option 3: Both (BEST)
```env
GROQ_API_KEY=gsk_your_groq_key
OPENAI_API_KEY=sk_your_openai_key
```

When both are available, Groq is used by default (free!).

## Model Selection

### Groq Models (When GROQ_API_KEY is set)

| Task | Model | Speed | Quality |
|------|-------|-------|---------|
| Intent Classification | llama-3.1-8b-instant | ⚡⚡⚡ | ⭐⭐⭐ |
| Entity Extraction | llama-3.1-70b-versatile | ⚡⚡ | ⭐⭐⭐⭐⭐ |
| AI Agent | llama-3.1-70b-versatile | ⚡⚡ | ⭐⭐⭐⭐⭐ |

### OpenAI Models (When OPENAI_API_KEY is set)

| Task | Model | Speed | Quality |
|------|-------|-------|---------|
| Intent Classification | gpt-4o-mini | ⚡⚡ | ⭐⭐⭐⭐ |
| Entity Extraction | gpt-4o-mini | ⚡⚡ | ⭐⭐⭐⭐ |
| AI Agent | gpt-4o | ⚡ | ⭐⭐⭐⭐⭐ |

## Files Updated

✅ `backend/src/langchain/providers/llm.provider.ts` - New multi-modal provider
✅ `backend/src/langchain/parsers/intent.parser.ts` - Uses LLMProvider
✅ `backend/src/langchain/parsers/meeting.parser.ts` - Uses LLMProvider
✅ `backend/src/langchain/mcp-agent.service.ts` - Uses LLMProvider

## Benefits

### Flexibility
- ✅ Works with Groq (free)
- ✅ Works with OpenAI (paid)
- ✅ Works with both (automatic selection)

### Cost Optimization
- ✅ Prioritizes free provider (Groq)
- ✅ Falls back to paid if needed
- ✅ No code changes required

### Easy Switching
```bash
# Switch to Groq (free)
GROQ_API_KEY=gsk_...
# Remove or comment out OPENAI_API_KEY

# Switch to OpenAI (paid)
OPENAI_API_KEY=sk-...
# Remove or comment out GROQ_API_KEY

# Use both (Groq prioritized)
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...
```

## Provider Detection

Check which provider is active:

```typescript
const provider = LLMProvider.getProvider();
// Returns: 'groq' | 'openai' | 'none'

console.log(`Using provider: ${provider}`);
```

## Error Handling

If no API key is configured:

```
Error: No LLM API key found. 
Please set either GROQ_API_KEY or OPENAI_API_KEY in .env
```

## Testing

### Test with Groq
1. Set `GROQ_API_KEY` in `.env`
2. Remove/comment `OPENAI_API_KEY`
3. Restart backend
4. Check logs: "Using provider: groq"

### Test with OpenAI
1. Set `OPENAI_API_KEY` in `.env`
2. Remove/comment `GROQ_API_KEY`
3. Restart backend
4. Check logs: "Using provider: openai"

### Test Fallback
1. Set both keys
2. Restart backend
3. Should use Groq (free) by default

## Migration from Single Provider

### Before
```typescript
import { ChatGroq } from '@langchain/groq';

const model = new ChatGroq({
    model: 'llama-3.1-70b-versatile',
    apiKey: process.env.GROQ_API_KEY,
});
```

### After
```typescript
import { LLMProvider } from './providers/llm.provider';

const model = LLMProvider.createChatModel({
    task: 'agent',
    temperature: 0
});
```

## Advantages

1. **No Vendor Lock-in**: Easy to switch providers
2. **Cost Optimization**: Automatically uses free option
3. **Reliability**: Fallback if one provider fails
4. **Simplicity**: One line of code for any provider
5. **Maintainability**: Centralized provider logic

## Future Enhancements

Potential additions:
- [ ] Anthropic Claude support
- [ ] Azure OpenAI support
- [ ] Custom model selection per task
- [ ] Provider health checking
- [ ] Automatic failover
- [ ] Usage tracking and analytics

## Summary

The multi-modal approach gives you:
- ✅ **Flexibility** - Use any provider
- ✅ **Cost savings** - Prioritize free options
- ✅ **Reliability** - Fallback support
- ✅ **Simplicity** - One API for all providers

Just set your preferred API key(s) and the system handles the rest! 🚀
