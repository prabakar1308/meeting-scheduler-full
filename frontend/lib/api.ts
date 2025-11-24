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
    } else {
        delete apiClient.defaults.headers.common['Authorization'];
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
    createIfFree?: boolean;
}

export const api = {
    async suggestMeetings(params: SuggestMeetingsParams): Promise<MeetingSuggestion[]> {
        const response = await apiClient.post('/scheduling/suggest', params);
        return response.data;
    },

    async scheduleMeeting(params: ScheduleMeetingParams) {
        const response = await apiClient.post('/scheduling/schedule', params);
        return response.data;
    },
};

export default apiClient;
