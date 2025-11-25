import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';

// Define the meeting data schema
export const meetingDataSchema = z.object({
    subject: z.string().optional().describe('Meeting title or subject'),
    attendees: z.array(z.string().email()).optional().describe('Email addresses of attendees'),
    startTime: z.string().optional().describe('Meeting start time in ISO 8601 format (UTC)'),
    endTime: z.string().optional().describe('Meeting end time in ISO 8601 format (UTC)'),
    duration: z.number().optional().describe('Meeting duration in minutes'),
    isComplete: z.boolean().describe('Whether all required fields are present'),
    missingFields: z.array(z.string()).describe('List of missing required fields'),
    confidence: z.number().min(0).max(1).describe('Confidence in the extraction'),
});

export type MeetingData = z.infer<typeof meetingDataSchema>;

export class MeetingParser {
    private parser: StructuredOutputParser<typeof meetingDataSchema>;
    private model: ChatOpenAI;

    constructor() {
        this.parser = StructuredOutputParser.fromZodSchema(meetingDataSchema);
        this.model = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0.3,
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }

    async extractMeetingData(userInput: string, conversationHistory?: string[]): Promise<MeetingData> {
        const currentTime = new Date();
        const istTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        const formatInstructions = this.parser.getFormatInstructions();

        const prompt = new PromptTemplate({
            template: `You are an AI assistant that extracts meeting details from natural language.

Current date and time in IST: {currentTime}
Current date: {currentDate}

Previous conversation context:
{history}

Current user input: {input}

Extract the following meeting information:
1. subject: Meeting title/subject
2. attendees: Array of email addresses
3. startTime: ISO 8601 format in UTC (convert from IST if time is mentioned)
4. endTime: ISO 8601 format in UTC
5. duration: Duration in minutes (if specified)

Important timezone rules:
- All times mentioned are in IST (India Standard Time, UTC+5:30)
- Convert IST to UTC for startTime and endTime
- "today" means {currentDate}
- "tomorrow" means {tomorrowDate}

Determine if all REQUIRED fields are present:
- attendees (at least one)
- startTime OR (date + time)
- duration OR endTime

Set isComplete to true only if all required fields are present.
List any missing required fields in missingFields array.

{format_instructions}`,
            inputVariables: ['input', 'history', 'currentTime', 'currentDate', 'tomorrowDate'],
            partialVariables: { format_instructions: formatInstructions },
        });

        const tomorrow = new Date(istTime);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const formattedPrompt = await prompt.format({
            input: userInput,
            history: conversationHistory?.join('\\n') || 'No previous context',
            currentTime: istTime.toISOString(),
            currentDate: istTime.toISOString().split('T')[0],
            tomorrowDate: tomorrow.toISOString().split('T')[0],
        });

        const response = await this.model.invoke(formattedPrompt);
        const parsed = await this.parser.parse(response.content as string);

        return parsed;
    }

    /**
     * Generate clarifying questions for missing fields
     */
    async generateClarifyingQuestions(missingFields: string[]): Promise<string> {
        const prompt = `Generate a friendly, natural question to ask the user for the following missing meeting information: ${missingFields.join(', ')}.
    
Keep it conversational and ask for the most important missing field first.
If multiple fields are missing, you can ask for them together if it makes sense.`;

        const response = await this.model.invoke(prompt);
        return response.content as string;
    }
}
