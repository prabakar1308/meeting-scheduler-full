import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMProvider } from '../providers/llm.provider';

// Define the intent schema
export const intentSchema = z.object({
    intent: z.enum(['schedule_new', 'modify_existing', 'ask_question', 'clarify', 'cancel', 'confirm', 'select_slot']).describe('The user\'s primary intent'),
    confidence: z.number().min(0).max(1).describe('Confidence score for the classification'),
    context: z.string().optional().describe('Additional context about the intent'),
    extractedData: z.object({
        subject: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        duration: z.number().optional(),
        slotId: z.string().nullable().optional().describe('Slot ID or rank if selecting a slot'),
    }).optional().describe('Any meeting data that could be extracted from the input'),
});

export type IntentClassification = z.infer<typeof intentSchema>;

export class IntentParser {
    private parser: StructuredOutputParser<typeof intentSchema>;
    private model: any;

    constructor() {
        this.parser = StructuredOutputParser.fromZodSchema(intentSchema);
        this.model = LLMProvider.createChatModel({
            task: 'intent',
            temperature: 0
        });
    }

    async classifyIntent(userInput: string, conversationHistory?: string[]): Promise<IntentClassification> {
        const prompt = `You are an AI assistant that classifies user intents for a meeting scheduling system.

Analyze the user's input and classify their intent into one of these categories:
- schedule_new: User wants to schedule a new meeting
- modify_existing: User wants to modify a previously discussed meeting
- ask_question: User is asking a question about scheduling or availability
- clarify: User is providing additional information or clarification
- cancel: User wants to cancel a meeting or stop the process
- confirm: User is confirming an action (e.g., "Yes", "Go ahead", "Looks good")
- select_slot: User is selecting a time slot (e.g., "The first one", "Slot 2", "10am works")

Previous conversation context:
${conversationHistory?.join('\n') || 'No previous context'}

Current user input: ${userInput}

Respond with a JSON object in this exact format:
{
  "intent": "one of the intents above",
  "confidence": 0.95,
  "context": "brief explanation",
  "extractedData": {
    "subject": "optional meeting subject",
    "attendees": ["optional", "emails"],
    "date": "optional date",
    "time": "optional time",
    "duration": 30,
    "slotId": null
  }
}

Provide a confidence score (0-1) and extract any meeting-related data you can identify.
If the user is selecting a slot, try to extract the slot ID or rank into extractedData.slotId.
Only include extractedData fields that you can confidently extract. Omit fields you're unsure about.`;

        try {
            const response = await this.model.invoke(prompt);
            const content = response.content as string;

            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate and return
            return intentSchema.parse(parsed);
        } catch (error: any) {
            console.error('Intent classification error:', error);
            // Fallback to a safe default
            return {
                intent: 'ask_question',
                confidence: 0.5,
                context: 'Failed to parse intent, defaulting to ask_question',
                extractedData: {}
            };
        }
    }
}
