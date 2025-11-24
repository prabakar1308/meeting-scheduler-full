export class ParseMeetingRequestDto {
    naturalLanguageInput!: string;
}

export interface ParsedMeetingDetails {
    subject: string;
    attendees: string[];
    startTime: string; // ISO 8601 format
    endTime: string;   // ISO 8601 format
    duration?: number; // in minutes
    confidence: number; // 0-1 score
    parsedFrom: string; // original input
}
