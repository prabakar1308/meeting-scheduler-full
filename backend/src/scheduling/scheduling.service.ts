import { Injectable, Logger, Inject } from '@nestjs/common';
import { GraphClient } from '../graph/graph.client';
import { UserSyncService } from '../user-sync/user-sync.service';
import { AgentService } from '../agent/agent.service';
import OpenAI from 'openai';
const logger = new Logger('SchedulingService');

@Injectable()
export class SchedulingService {
  private openai: OpenAI;

  constructor(
    @Inject('PRISMA') private prisma: any,
    private graph: GraphClient,
    private agent: AgentService,
    private userSync: UserSyncService,
  ) {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

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
    // Use organizer from request (signed-in user from JWT token)
    // If not provided, fetch from Microsoft Graph API as fallback
    let organizer = dto.organizer;

    if (!organizer) {
      // Fallback: Dynamically fetch the authenticated user's email from Graph API
      organizer = await this.graph.getAuthenticatedUserEmail();
      logger.log(`No organizer provided, using Graph API fallback: ${organizer}`);
    } else {
      logger.log(`Using signed-in user as organizer: ${organizer}`);
    }

    const { attendees, start, end, subject, createIfFree } = dto;

    await this.userSync.ensureUserInPrisma(this.prisma, organizer);

    // Separate internal and external attendees
    const { internal, external } = this.categorizeAttendees(attendees, organizer);

    logger.log(`Internal attendees: ${internal.length}, External attendees: ${external.length}`);

    if (external.length > 0) {
      logger.log(`External users detected: ${external.map(a => a.emailAddress?.address || a).join(', ')}`);
      logger.log('Note: External users will receive invitations but availability cannot be checked');
    }

    // Create meeting with ALL attendees (both internal and external)
    // Use subject from payload, or default to "Meeting"
    const meetingSubject = subject || 'Meeting';

    const payload = {
      subject: meetingSubject,
      body: {
        contentType: 'HTML',
        content: `<p>Meeting scheduled via Agentic Scheduler.</p>`
      },
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      attendees, // Include ALL attendees (internal + external)
    };

    const created = await this.graph.createEventForUser(organizer, payload);
    const organizerRecord = await this.userSync.ensureUserInPrisma(this.prisma, organizer);

    // Log the meeting
    const meeting = await this.prisma.meeting.create({
      data: {
        subject: meetingSubject,
        start: new Date(start),
        end: new Date(end),
        organizerId: organizerRecord.id,
      },
    });

    if (external.length > 0) {
      logger.log(`Meeting created with ${external.length} external attendee(s): ${external.map(a => a.emailAddress?.address).join(', ')}`);
    }

    return {
      message: 'Meeting scheduled',
      createdEvent: created,
      externalAttendees: external.length > 0 ? external.map(a => a.emailAddress?.address || a) : undefined
    };
  }

  async parseNaturalLanguage(input: string, organizer?: string): Promise<any> {
    try {
      const currentTime = new Date();
      const istTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

      const systemPrompt = `You are a meeting scheduler assistant. Parse the user's natural language input and extract meeting details.
Current date and time in IST: ${istTime.toISOString()}
Current date: ${istTime.toISOString().split('T')[0]}

Extract the following information:
1. subject: Meeting title/subject
2. attendees: Array of email addresses
3. startTime: ISO 8601 format in UTC (convert from IST if time is mentioned)
4. endTime: ISO 8601 format in UTC
5. duration: Duration in minutes (if specified)

Important timezone rules:
- All times mentioned are in IST (India Standard Time, UTC+5:30)
- Convert IST to UTC for startTime and endTime
- "today" means ${istTime.toISOString().split('T')[0]}
- "tomorrow" means ${new Date(istTime.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

Return ONLY a JSON object with these fields. If duration is specified but not end time, calculate endTime. If end time is specified but not duration, calculate duration.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');

      // Get organizer email
      if (!organizer) {
        organizer = await this.graph.getAuthenticatedUserEmail();
      }

      // Categorize attendees
      const attendeeObjects = parsed.attendees.map((email: string) => ({
        emailAddress: { address: email }
      }));
      const { internal, external } = this.categorizeAttendees(attendeeObjects, organizer);

      // Check availability for internal users
      let availabilityStatus: any = {};
      let isSlotBusy = false;
      let alternativeSlots: any[] = [];

      if (internal.length > 0) {
        try {
          const scheduleResponse = await this.graph.getSchedule(
            organizer,
            internal.map(a => a.emailAddress.address),
            parsed.startTime,
            parsed.endTime
          );

          // Parse schedule response to check if anyone is busy
          logger.log('📅 Schedule API Response:', JSON.stringify(scheduleResponse, null, 2));

          const requestedStart = new Date(parsed.startTime);
          const requestedEnd = new Date(parsed.endTime);

          logger.log(`🕐 Requested time slot (UTC): ${requestedStart.toISOString()} - ${requestedEnd.toISOString()}`);

          scheduleResponse.value?.forEach((schedule: any) => {
            const email = schedule.scheduleId;

            logger.log(`\n👤 Checking availability for: ${email}`);
            logger.log(`   Total schedule items: ${schedule.scheduleItems?.length || 0}`);

            // Check if any schedule item overlaps with the requested time slot
            const isBusy = schedule.scheduleItems?.some((item: any) => {
              logger.log(`   📅 Item: ${item.start.dateTime} - ${item.end.dateTime} (${item.status})`);

              if (item.status !== 'busy' && item.status !== 'tentative') {
                logger.log(`      ✓ Skipping (status: ${item.status})`);
                return false;
              }

              // Check for time overlap
              // Ensure we're working with UTC times
              const itemStart = new Date(item.start.dateTime + (item.start.dateTime.endsWith('Z') ? '' : 'Z'));
              const itemEnd = new Date(item.end.dateTime + (item.end.dateTime.endsWith('Z') ? '' : 'Z'));

              logger.log(`      Item Start (UTC): ${itemStart.toISOString()}`);
              logger.log(`      Item End (UTC):   ${itemEnd.toISOString()}`);
              logger.log(`      Requested Start:  ${requestedStart.toISOString()}`);
              logger.log(`      Requested End:    ${requestedEnd.toISOString()}`);

              // Two time ranges overlap if: start1 < end2 AND start2 < end1
              const overlaps = requestedStart < itemEnd && itemStart < requestedEnd;

              logger.log(`      Overlap check: ${requestedStart.toISOString()} < ${itemEnd.toISOString()} = ${requestedStart < itemEnd}`);
              logger.log(`                     ${itemStart.toISOString()} < ${requestedEnd.toISOString()} = ${itemStart < requestedEnd}`);
              logger.log(`      Result: ${overlaps ? '⚠️ CONFLICT!' : '✓ No conflict'}`);

              return overlaps;
            });

            availabilityStatus[email] = isBusy ? 'busy' : 'free';
            logger.log(`\n   Final status for ${email}: ${isBusy ? '✗ BUSY' : '✓ FREE'}`);
            if (isBusy) isSlotBusy = true;
          });

          logger.log('\n📊 Final availability status:', availabilityStatus);
          logger.log('⚠️ Is slot busy:', isSlotBusy);

          // If slot is busy, find alternative time slots
          if (isSlotBusy) {
            logger.log('🔍 Finding alternative time slots...');

            // Calculate duration from parsed times
            const startDate = new Date(parsed.startTime);
            const endDate = new Date(parsed.endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            // Search for slots in the next 7 days, starting from the requested date
            const searchStartDate = new Date(startDate);
            searchStartDate.setHours(0, 0, 0, 0); // Start from beginning of the day

            const searchEndDate = new Date(searchStartDate);
            searchEndDate.setDate(searchEndDate.getDate() + 7);

            try {
              const findRes = await this.graph.findMeetingTimes(organizer, internal, {
                attendees: internal,
                timeConstraint: {
                  timeslots: [{
                    start: { dateTime: searchStartDate.toISOString(), timeZone: 'UTC' },
                    end: { dateTime: searchEndDate.toISOString(), timeZone: 'UTC' }
                  }],
                  activityDomain: 'work' // Only suggest during work hours
                },
                meetingDuration: `PT${durationMinutes}M`,
                maxCandidates: 10, // Request more to filter later
                minimumAttendeePercentage: 100, // All attendees must be available
                isOrganizerOptional: false,
              });

              // Filter out slots outside business hours (9 AM - 6 PM IST = 3:30 AM - 12:30 PM UTC)
              const businessHoursSlots = (findRes.meetingTimeSuggestions || [])
                .filter((slot: any) => {
                  const slotStart = new Date(slot.meetingTimeSlot.start.dateTime);
                  const istHour = (slotStart.getUTCHours() + 5) % 24 + (slotStart.getUTCMinutes() >= 30 ? 1 : 0);
                  // IST business hours: 9 AM to 6 PM
                  return istHour >= 9 && istHour < 18;
                })
                .map((slot: any) => {
                  const slotStart = new Date(slot.meetingTimeSlot.start.dateTime);
                  // Calculate time difference from requested slot (in minutes)
                  const timeDiff = Math.abs(slotStart.getTime() - startDate.getTime()) / (1000 * 60);
                  return {
                    slot,
                    timeDiff,
                    slotStart
                  };
                })
                .sort((a: any, b: any) => {
                  // Calculate time difference in hours
                  const aHoursDiff = a.timeDiff / 60;
                  const bHoursDiff = b.timeDiff / 60;

                  // Check if same day
                  const sameDay = (date1: Date, date2: Date) =>
                    date1.getUTCFullYear() === date2.getUTCFullYear() &&
                    date1.getUTCMonth() === date2.getUTCMonth() &&
                    date1.getUTCDate() === date2.getUTCDate();

                  const aIsSameDay = sameDay(a.slotStart, startDate);
                  const bIsSameDay = sameDay(b.slotStart, startDate);

                  // Priority 1: Slots within 3 hours (very close to requested time)
                  const aIsVeryClose = aHoursDiff <= 3;
                  const bIsVeryClose = bHoursDiff <= 3;

                  if (aIsVeryClose && !bIsVeryClose) return -1;
                  if (!aIsVeryClose && bIsVeryClose) return 1;

                  // Priority 2: Same day (but only if both are or aren't very close)
                  if (aIsSameDay && !bIsSameDay) return -1;
                  if (!aIsSameDay && bIsSameDay) return 1;

                  // Priority 3: Sort by time proximity
                  return a.timeDiff - b.timeDiff;
                })
                .slice(0, 5)
                .map((item: any, index: number) => {
                  const slot = {
                    rank: index + 1,
                    start: item.slot.meetingTimeSlot.start.dateTime,
                    end: item.slot.meetingTimeSlot.end.dateTime,
                    confidence: item.slot.confidence,
                    reason: item.slot.suggestionReason || 'Available time slot',
                    attendeeAvailability: item.slot.attendeeAvailability?.map((a: any) => ({
                      email: a.attendee?.emailAddress?.address,
                      availability: a.availability
                    }))
                  };

                  // Log the slot time in both UTC and IST for verification
                  const startDate = new Date(slot.start);
                  const istTime = startDate.toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  });
                  logger.log(`   Slot ${slot.rank}: UTC ${slot.start} → IST ${istTime}`);

                  return slot;
                });

              alternativeSlots = businessHoursSlots;
              logger.log(`✅ Found ${alternativeSlots.length} alternative slots (filtered for business hours, sorted by proximity)`);
            } catch (error) {
              logger.warn('Failed to find alternative slots:', error);
            }
          }
        } catch (error) {
          logger.warn('Failed to check availability:', error);
        }
      }

      logger.log('📤 Returning parsed details with availability:', {
        internalCount: internal.length,
        externalCount: external.length,
        availabilityStatus,
        isSlotBusy,
        alternativeSlotsCount: alternativeSlots.length
      });

      return {
        subject: parsed.subject || 'Meeting',
        attendees: parsed.attendees || [],
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        duration: parsed.duration,
        confidence: 0.9,
        parsedFrom: input,
        internalAttendees: internal.map(a => a.emailAddress.address),
        externalAttendees: external.map(a => a.emailAddress.address),
        availabilityStatus,
        isSlotBusy,
        hasExternalAttendees: external.length > 0,
        alternativeSlots: isSlotBusy ? alternativeSlots : [],
      };
    } catch (error) {
      logger.error('Error parsing natural language:', error);
      throw new Error('Failed to parse meeting details from input');
    }
  }
}
