import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';

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
    private model: ChatOpenAI;

    constructor() {
        this.parser = StructuredOutputParser.fromZodSchema(intentSchema);
        this.model = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0,
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }

    async classifyIntent(userInput: string, conversationHistory?: string[]): Promise<IntentClassification> {
        const formatInstructions = this.parser.getFormatInstructions();

        const prompt = new PromptTemplate({
            template: `You are an AI assistant that classifies user intents for a meeting scheduling system.

Analyze the user's input and classify their intent into one of these categories:
- schedule_new: User wants to schedule a new meeting
- modify_existing: User wants to modify a previously discussed meeting
- ask_question: User is asking a question about scheduling or availability
- clarify: User is providing additional information or clarification
- cancel: User wants to cancel a meeting or stop the process
- confirm: User is confirming an action (e.g., "Yes", "Go ahead", "Looks good")
- select_slot: User is selecting a time slot (e.g., "The first one", "Slot 2", "10am works")

Previous conversation context:
{history}

Current user input: {input}

{format_instructions}

Provide a confidence score (0-1) and extract any meeting-related data you can identify.
If the user is selecting a slot, try to extract the slot ID or rank into extractedData.slotId.`,
            inputVariables: ['input', 'history'],
            partialVariables: { format_instructions: formatInstructions },
        });

        const formattedPrompt = await prompt.format({
            input: userInput,
            history: conversationHistory?.join('\\n') || 'No previous context',
        });

        const response = await this.model.invoke(formattedPrompt);
        const parsed = await this.parser.parse(response.content as string);

        return parsed;
    }
}
