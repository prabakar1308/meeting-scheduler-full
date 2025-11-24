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

  /**
   * Determine if an email belongs to an internal user (same organization)
   * You can customize this logic based on your organization's domain(s)
   */
  private isInternalUser(email: string, organizerEmail: string): boolean {
    // Extract domain from organizer email
    const organizerDomain = organizerEmail.split('@')[1];
    const userDomain = email.split('@')[1];

    // Check if domains match
    return userDomain === organizerDomain;
  }

  /**
   * Separate attendees into internal and external users
   */
  private categorizeAttendees(attendees: any[], organizerEmail: string) {
    const internal: any[] = [];
    const external: any[] = [];

    attendees.forEach(attendee => {
      const email = attendee.emailAddress?.address || attendee;
      if (this.isInternalUser(email, organizerEmail)) {
        internal.push(attendee);
      } else {
        external.push(attendee);
      }
    });

    return { internal, external };
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

    // Validate that start and end times are in the future (timestamp-specific validation)
    // Using IST timezone: 10:00 AM to 9:00 PM (Asia/Kolkata)
    // IST is UTC+5:30, so:
    // 10:00 AM IST = 04:30 UTC
    // 9:00 PM IST = 15:30 UTC
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Extract date part from start to check if it's today
    const today = new Date().toISOString().split('T')[0];
    let startDateOnly = start.split('T')[0];

    // Smart time logic:
    // - If startDate is today, validate against current time
    // - If startDate is in the future, validate against 10:00 AM IST
    let effectiveStartTime: Date;
    if (startDateOnly === today) {
      // For today, use current time
      effectiveStartTime = now;
    } else {
      // For future dates, use 10:00 AM IST (04:30 UTC)
      effectiveStartTime = new Date(`${startDateOnly}T04:30:00Z`);
    }

    if (effectiveStartTime < now) {
      const timeMsg = startDateOnly === today
        ? 'current time'
        : `${startDateOnly} 10:00 AM IST`;
      throw new Error(`Start time must be after ${timeMsg}`);
    }

    if (endDate < now) {
      throw new Error('End time must be in the future');
    }

    if (startDate >= endDate) {
      throw new Error('End time must be after start time');
    }

    await this.userSync.ensureUserInPrisma(this.prisma, organizer);

    // Separate internal and external attendees
    const { internal, external } = this.categorizeAttendees(attendees, organizer);

    logger.log(`Internal attendees: ${internal.length}, External attendees: ${external.length}`);

    if (external.length > 0) {
      logger.log(`External users detected: ${external.map(a => a.emailAddress?.address || a).join(', ')}`);
      logger.log('Note: External users will receive invitations but availability cannot be checked');
    }

    // Only check availability for internal users
    // External users will still be included in the meeting invite
    const attendeesForAvailabilityCheck = internal.length > 0 ? internal : attendees;

    // Smart time logic for API request:
    // - If start date is today, use the actual start time from request (which is current time)
    // - If start date is future, ensure it uses 10:00 AM IST (04:30 UTC)
    // const startDateOnly = start.split('T')[0];
    let apiStartTime = start;

    // If the start time is before current time (shouldn't happen due to validation, but safety check)
    if (new Date(start) < now) {
      apiStartTime = now.toISOString();
    }

    const findRes = await this.graph.findMeetingTimes(organizer, attendeesForAvailabilityCheck, {
      attendees: attendeesForAvailabilityCheck,
      timeConstraint: {
        timeslots: [{
          start: { dateTime: apiStartTime, timeZone: 'UTC' },
          end: { dateTime: end, timeZone: 'UTC' }
        }]
      },
      maxCandidates: 20,
      isOrganizerOptional: false,
    });

    const ranked = findRes.meetingTimeSuggestions || [];

    if (!ranked || ranked.length === 0) {
      return [];
    }

    // Return only top 5 suggestions for faster processing
    const topSuggestions = ranked.slice(0, 5);

    return topSuggestions.map((slot: any, index: number) => {
      const hasExternal = external.length > 0;
      const suggestion: any = {
        rank: index + 1,
        start: slot.meetingTimeSlot.start.dateTime,
        end: slot.meetingTimeSlot.end.dateTime,
        score: slot.confidence,
        reason: slot.suggestionReason || 'Available time slot',
        hasExternalAttendees: hasExternal,
        externalAttendeeCount: external.length,
      };

      if (hasExternal) {
        suggestion.note = `This meeting includes ${external.length} external attendee(s). Their availability was not checked.`;
      }

      return suggestion;
    });
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

    // Separate internal and external attendees for logging
    const { internal, external } = this.categorizeAttendees(attendees, organizer);

    if (external.length > 0) {
      logger.log(`Creating meeting with ${external.length} external attendee(s): ${external.map(a => a.emailAddress?.address || a).join(', ')}`);
    }

    // Create meeting with ALL attendees (both internal and external)
    // External users will receive email invitations
    const payload = {
      subject: `Meeting (Rank ${best.rank})`,
      body: { contentType: 'HTML', content: `<p>Meeting scheduled via Agentic Scheduler.</p><p>Reason: ${best.reason}</p>${external.length > 0 ? `<p><strong>Note:</strong> This meeting includes ${external.length} external attendee(s).</p>` : ''}` },
      start: { dateTime: best.start, timeZone: 'UTC' },
      end: { dateTime: best.end, timeZone: 'UTC' },
      attendees, // Include ALL attendees (internal + external)
    };
    const created = await this.graph.createEventForUser(organizer, payload);
    const organizerRecord = await this.userSync.ensureUserInPrisma(this.prisma, organizer);
    await this.prisma.meeting.create({
      data: { subject: payload.subject, start: new Date(best.start), end: new Date(best.end), organizerId: organizerRecord.id }
    });
    return {
      createdEvent: created,
      chosen: best,
      suggestions: ranked,
      externalAttendees: external.length > 0 ? external.map(a => a.emailAddress?.address || a) : undefined
    };
  }
}
