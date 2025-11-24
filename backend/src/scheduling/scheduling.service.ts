import { Injectable, Inject, Logger } from '@nestjs/common';
import { GraphClient } from '../graph/graph.client';
import { UserSyncService } from '../user-sync/user-sync.service';
import { AgentService } from '../agent/agent.service';
const logger = new Logger('SchedulingService');

@Injectable()
export class SchedulingService {
  constructor(
    private graph: GraphClient,
    private userSync: UserSyncService,
    private agent: AgentService,
    @Inject('PRISMA') private prisma: any,
  ) { }

  private extractSlots(findResult: any) {
    return (findResult?.meetingTimeSuggestions || []).map((s: any) => ({
      start: s.meetingTimeSlot?.start?.dateTime,
      end: s.meetingTimeSlot?.end?.dateTime,
      available: true,
    }));
  }

  async suggestSlots(dto: any) {
    // Use organizer from request, or fetch from Microsoft Graph API
    let organizer = dto.organizer;

    if (!organizer) {
      // Dynamically fetch the authenticated user's email from Graph API
      organizer = await this.graph.getAuthenticatedUserEmail();
      logger.log(`Using authenticated user as organizer: ${organizer}`);
    }

    const { attendees, start, end } = dto;
    await this.userSync.ensureUserInPrisma(this.prisma, organizer);
    const findRes = await this.graph.findMeetingTimes(organizer, attendees, {
      attendees,
      timeConstraint: {
        timeslots: [{ start: { dateTime: start, timeZone: 'UTC' }, end: { dateTime: end, timeZone: 'UTC' } }]
      },
      maxCandidates: 20,
      isOrganizerOptional: false,
    });
    const slots = this.extractSlots(findRes);
    const ranked = await this.agent.rankSlots(slots, { organizer, attendees });
    return ranked;
  }

  async scheduleMeeting(dto: any) {
    // Use organizer from request, or fetch from Microsoft Graph API
    let organizer = dto.organizer;

    if (!organizer) {
      // Dynamically fetch the authenticated user's email from Graph API
      organizer = await this.graph.getAuthenticatedUserEmail();
      logger.log(`Using authenticated user as organizer: ${organizer}`);
    }

    const { attendees, start, end, createIfFree = true } = dto;

    // Pass organizer to suggestSlots
    const ranked = await this.suggestSlots({ ...dto, organizer });
    if (!ranked || !ranked.length) return { message: 'No suggestions available', suggestions: [] };
    const best = ranked[0];
    if (!createIfFree) return { suggestions: ranked };
    const payload = {
      subject: `Meeting (Rank ${best.rank})`,
      body: { contentType: 'HTML', content: `<p>Meeting scheduled via Agentic Scheduler.</p><p>Reason: ${best.reason}</p>` },
      start: { dateTime: best.start, timeZone: 'UTC' },
      end: { dateTime: best.end, timeZone: 'UTC' },
      attendees,
    };
    const created = await this.graph.createEventForUser(organizer, payload);
    const organizerRecord = await this.userSync.ensureUserInPrisma(this.prisma, organizer);
    await this.prisma.meeting.create({
      data: { subject: payload.subject, start: new Date(best.start), end: new Date(best.end), organizerId: organizerRecord.id }
    });
    return { createdEvent: created, chosen: best, suggestions: ranked };
  }
}
