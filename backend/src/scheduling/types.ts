export interface Attendee { emailAddress: { address: string; name?: string; }; type?: 'Required' | 'Optional'; }
export interface Slot { start: string; end: string; available?: boolean; }
export interface RankedSlot { rank: number; start: string; end: string; score: number; reason: string; }
export interface SuggestRequestDTO { organizer: string; attendees: Attendee[]; start: string; end: string; }
export interface ScheduleRequestDTO extends SuggestRequestDTO { createIfFree?: boolean; }
