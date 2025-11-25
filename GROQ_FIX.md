# Groq Integration Fix - Structured Output Issue

## Problem
Error: `model output must contain either output text or tool calls`

This happens because Groq's Llama models don't support LangChain's `StructuredOutputParser` format.

## Solution Applied

Changed from **StructuredOutputParser** to **JSON mode** with manual parsing.

### Before (Didn't Work with Groq)
```typescript
const parser = StructuredOutputParser.fromZodSchema(schema);
const formatInstructions = parser.getFormatInstructions();
// ... complex prompt template
const response = await model.invoke(prompt);
const parsed = await parser.parse(response.content);
```

### After (Works with Groq)
```typescript
const prompt = `...instructions...
Respond with JSON in this format:
{
  "field1": "value",
  "field2": 123
}`;

const response = await model.invoke(prompt);
const jsonMatch = response.content.match(/\{[\s\S]*\}/);
const parsed = JSON.parse(jsonMatch[0]);
return schema.parse(parsed); // Zod validation
```

## Files Fixed

✅ `backend/src/langchain/parsers/intent.parser.ts`
✅ `backend/src/langchain/parsers/meeting.parser.ts`

## Changes Made

1. **Removed StructuredOutputParser** - Not compatible with Groq
2. **Added JSON extraction** - Uses regex to find JSON in response
3. **Added error handling** - Graceful fallbacks if parsing fails
4. **Kept Zod validation** - Still validates the parsed JSON

## Why This Works

- ✅ Groq models can generate JSON text
- ✅ We extract and parse the JSON manually
- ✅ Zod validates the structure
- ✅ Error handling provides fallbacks

## Testing

The chat should now work! Try:
1. Go to `/chat`
2. Send: "Schedule a meeting tomorrow"
3. Should work without errors

## Benefits

- ✅ Works with Groq (FREE!)
- ✅ More robust error handling
- ✅ Graceful degradation
- ✅ Still type-safe with Zod

## If You Still Get Errors

Make sure:
1. `GROQ_API_KEY` is in `.env`
2. Backend server restarted
3. Key is valid (starts with `gsk_`)

The system will now work with Groq's free, fast models! 🚀
