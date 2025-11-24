import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests automatically
export const setAuthToken = (token: string | null) => {
    if (token) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log('✅ API Client: Authorization header set with Bearer token');
    } else {
        delete apiClient.defaults.headers.common['Authorization'];
        console.log('🚫 API Client: Authorization header removed');
    }
};

export interface Attendee {
    emailAddress: {
        address: string;
        name?: string;
    };
    type?: 'Required' | 'Optional';
}

export interface MeetingSuggestion {
    rank: number;
    start: string;
    end: string;
    score: number;
    reason: string;
}

export interface SuggestMeetingsParams {
    attendees: Attendee[];
    start: string;
    end: string;
}

export interface ScheduleMeetingParams extends SuggestMeetingsParams {
    subject?: string;
    organizer?: string;
    createIfFree?: boolean;
}

export const api = {
    suggestMeetings: async (params: SuggestMeetingsParams): Promise<MeetingSuggestion[]> => {
        const response = await apiClient.post('/scheduling/suggest', params);
        return response.data;
    },

    scheduleMeeting: async (params: ScheduleMeetingParams) => {
        const response = await apiClient.post('/scheduling/schedule', params);
        return response.data;
    },

    parseNaturalLanguage: async (input: string) => {
        const response = await apiClient.post('/scheduling/parse-natural-language', {
            naturalLanguageInput: input
        });
        return response.data;
    },
};

export default apiClient;
