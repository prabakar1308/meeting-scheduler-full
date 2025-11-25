import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMProvider } from '../providers/llm.provider';

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
    private model: any;

    constructor() {
        this.parser = StructuredOutputParser.fromZodSchema(meetingDataSchema);
        this.model = LLMProvider.createChatModel({
            task: 'extraction',
            temperature: 0.3
        });
    }

    async extractMeetingData(userInput: string, conversationHistory?: string[]): Promise<MeetingData> {
        const currentTime = new Date();
        const istTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const tomorrow = new Date(istTime);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const prompt = `You are an AI assistant that extracts meeting details from natural language.

Current date and time in IST: ${istTime.toISOString()}
Current date: ${istTime.toISOString().split('T')[0]}

Previous conversation context:
${conversationHistory?.join('\n') || 'No previous context'}

Current user input: ${userInput}

Extract the following meeting information:
1. subject: Meeting title/subject
2. attendees: Array of email addresses (or names if emails not provided)
3. startTime: ISO 8601 format in UTC (convert from IST if time is mentioned)
4. endTime: ISO 8601 format in UTC
5. duration: Duration in minutes (if specified)

Important timezone rules:
- All times mentioned are in IST (India Standard Time, UTC+5:30)
- Convert IST to UTC for startTime and endTime
- "today" means ${istTime.toISOString().split('T')[0]}
- "tomorrow" means ${tomorrow.toISOString().split('T')[0]}

Determine if all REQUIRED fields are present:
- attendees (at least one)
- startTime OR (date + time)
- duration OR endTime

Set isComplete to true only if all required fields are present.
List any missing required fields in missingFields array.

Respond with a JSON object in this exact format:
{
  "subject": "optional meeting subject",
  "attendees": ["email@example.com"],
  "startTime": "2025-11-26T04:30:00Z",
  "endTime": "2025-11-26T05:00:00Z",
  "duration": 30,
  "isComplete": false,
  "missingFields": ["attendees", "time"],
  "confidence": 0.9
}

Only include fields you can confidently extract. For missing fields, include them in missingFields array.`;

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
            return meetingDataSchema.parse(parsed);
        } catch (error: any) {
            console.error('Meeting data extraction error:', error);
            // Fallback to incomplete data
            return {
                isComplete: false,
                missingFields: ['attendees', 'time', 'date'],
                confidence: 0.3
            };
        }
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
