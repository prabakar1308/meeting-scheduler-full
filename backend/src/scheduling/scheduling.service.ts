import { Injectable, Logger, Inject } from '@nestjs/common';
import { GraphClient } from '../graph/graph.client';
import { UserSyncService } from '../user-sync/user-sync.service';
import { AgentService } from '../agent/agent.service';
import { LLMProvider } from '../langchain/providers/llm.provider';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

const logger = new Logger('SchedulingService');

@Injectable()
export class SchedulingService {

  constructor(
    @Inject('PRISMA') private prisma: any,
    private graph: GraphClient,
    private agent: AgentService,
    private userSync: UserSyncService,
  ) {
    // Check if any LLM provider is available
    const provider = LLMProvider.getProvider();
    if (provider !== 'none') {
      logger.log(`✅ LLM provider initialized: ${provider}`);
    } else {
      logger.warn('⚠️  No LLM API key found - natural language features will be disabled');
    }
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

    // Validate required parameters
    if (!start || !end) {
      throw new Error('Missing required parameters: start and end times are required');
    }

    if (!attendees || attendees.length === 0) {
      throw new Error('Missing required parameter: at least one attendee is required');
    }

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

    // Validate that start is not before effective start time
    if (startDate < effectiveStartTime) {
      throw new Error(`Meeting start time must be at or after ${effectiveStartTime.toISOString()}`);
    }

    // Validate that end is not after 9:00 PM IST (15:30 UTC)
    const endDateOnly = end.split('T')[0];
    const maxEndTime = new Date(`${endDateOnly}T15:30:00Z`);
    if (endDate > maxEndTime) {
      throw new Error(`Meeting end time must be at or before 9:00 PM IST`);
    }

    await this.userSync.ensureUserInPrisma(this.prisma, organizer);

    // Separate internal and external attendees
    const { internal, external } = this.categorizeAttendees(attendees, organizer);

    logger.log(`Internal attendees: ${internal.length}, External attendees: ${external.length}`);

    if (external.length > 0) {
      logger.log(`External users detected: ${external.map(a => a.emailAddress?.address || a).join(', ')}`);
      logger.log('Note: External users cannot be checked for availability via Microsoft Graph');
    }

    // Only check availability for internal users
    const internalEmails = internal.map(a => a.emailAddress?.address || a);

    if (internalEmails.length === 0) {
      logger.log('No internal attendees to check availability for');
      return {
        slots: [],
        message: 'No internal attendees to check availability',
        externalAttendees: external.map(a => a.emailAddress?.address || a)
      };
    }

    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

    // Normalize attendees to Graph API format
    // Handle both plain strings and objects with emailAddress.address
    const normalizedAttendees = internal.map(attendee => {
      if (typeof attendee === 'string') {
        return {
          emailAddress: {
            address: attendee
          },
          type: 'Required'
        };
      }
      return attendee;
    });

    logger.log(`Normalized attendees for Graph API:`, JSON.stringify(normalizedAttendees, null, 2));

    // STEP 1: Check if the requested time slot is available using getSchedule
    logger.log(`🔍 Checking availability for requested time slot: ${start} to ${end}`);

    const scheduleResponse = await this.graph.getSchedule(
      organizer,
      internalEmails,
      start,
      end
    );

    logger.log(`📅 Schedule API response:`, JSON.stringify(scheduleResponse, null, 2));

    // Check if anyone is busy during the requested time
    let isRequestedSlotBusy = false;
    const availabilityStatus: Record<string, string> = {};

    scheduleResponse.value?.forEach((schedule: any) => {
      const email = schedule.scheduleId;
      const isBusy = schedule.scheduleItems?.some((item: any) => {
        if (item.status !== 'busy' && item.status !== 'tentative') {
          return false;
        }
        // Check for overlap with requested time
        const itemStart = new Date(item.start.dateTime + (item.start.dateTime.endsWith('Z') ? '' : 'Z'));
        const itemEnd = new Date(item.end.dateTime + (item.end.dateTime.endsWith('Z') ? '' : 'Z'));
        return startDate < itemEnd && itemStart < endDate;
      });

      availabilityStatus[email] = isBusy ? 'busy' : 'free';
      if (isBusy) isRequestedSlotBusy = true;
    });

    logger.log(`📊 Availability status:`, availabilityStatus);
    logger.log(`⚠️ Is requested slot busy: ${isRequestedSlotBusy}`);

    // STEP 2: If the requested slot is free, return it as the primary suggestion
    if (!isRequestedSlotBusy) {
      logger.log(`✅ Requested time slot is available!`);
      return {
        slots: [{
          start,
          end,
          available: true,
          confidence: 100,
          reason: 'Requested time slot is available for all attendees'
        }],
        externalAttendees: external.length > 0 ? external.map(a => a.emailAddress?.address || a) : undefined
      };
    }

    // STEP 3: If requested slot is busy, find alternative times
    logger.log(`⚠️ Requested slot is busy. Finding alternative times...`);

    const findRes = await this.graph.findMeetingTimes(organizer, normalizedAttendees, {
      attendees: normalizedAttendees,
      timeConstraint: {
        timeslots: [{
          start: { dateTime: start, timeZone: 'UTC' },
          end: { dateTime: end, timeZone: 'UTC' }
        }],
        activityDomain: 'work'
      },
      meetingDuration: `PT${duration}M`,
      maxCandidates: 5,
      minimumAttendeePercentage: 100,
      isOrganizerOptional: false,
    });

    logger.log(`📊 Graph API findMeetingTimes response:`, JSON.stringify(findRes, null, 2));

    const slots = this.extractSlots(findRes);

    logger.log(`✅ Extracted ${slots.length} alternative slots from Graph API response`);
    if (slots.length === 0) {
      logger.warn(`⚠️ No alternative slots found! Graph API response details:`);
      logger.warn(`   - emptySuggestionsReason: ${findRes?.emptySuggestionsReason}`);
      logger.warn(`   - meetingTimeSuggestions count: ${findRes?.meetingTimeSuggestions?.length || 0}`);
    }

    return {
      slots,
      requestedSlotBusy: true,
      availabilityStatus,
      externalAttendees: external.length > 0 ? external.map(a => a.emailAddress?.address || a) : undefined
    };
  }

  async scheduleMeeting(dto: any) {
    // Use organizer from request, or fetch from Microsoft Graph API as fallback
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

    // Normalize all attendees to Graph API format
    const normalizedAllAttendees = attendees.map((attendee: any) => {
      if (typeof attendee === 'string') {
        return {
          emailAddress: {
            address: attendee
          },
          type: 'Required'
        };
      }
      return attendee;
    });

    logger.log(`📧 Creating meeting with normalized attendees:`, JSON.stringify(normalizedAllAttendees, null, 2));

    const payload = {
      subject: meetingSubject,
      body: {
        contentType: 'HTML',
        content: `<p>Meeting scheduled via Agentic Scheduler.</p>`
      },
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      attendees: normalizedAllAttendees, // Use normalized attendees
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

  async checkAvailability(
    organizer: string,
    startTime: Date,
    endTime: Date,
    internalAttendees: string[]
  ): Promise<{
    isSlotBusy: boolean;
    availabilityStatus: Record<string, string>;
    alternativeSlots: any[];
  }> {
    let availabilityStatus: any = {};
    let isSlotBusy = false;
    let alternativeSlots: any[] = [];

    if (internalAttendees.length > 0) {
      try {
        const scheduleResponse = await this.graph.getSchedule(
          organizer,
          internalAttendees,
          startTime.toISOString(),
          endTime.toISOString()
        );

        // Parse schedule response to check if anyone is busy
        logger.log('📅 Schedule API Response:', JSON.stringify(scheduleResponse, null, 2));

        const requestedStart = startTime;
        const requestedEnd = endTime;

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
          const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

          // Search for slots starting from current time if requested date is today or past
          const searchStartDate = new Date(startTime);
          const now = new Date();

          // If the requested date is today or in the past, start from current time
          // Otherwise, start from beginning of the requested day
          if (searchStartDate <= now) {
            searchStartDate.setTime(now.getTime());
          } else {
            searchStartDate.setHours(0, 0, 0, 0);
          }

          const searchEndDate = new Date(searchStartDate);
          searchEndDate.setDate(searchEndDate.getDate() + 7);

          try {
            const findRes = await this.graph.findMeetingTimes(organizer, internalAttendees.map(email => ({ emailAddress: { address: email } })), {
              attendees: internalAttendees.map(email => ({ emailAddress: { address: email } })),
              timeConstraint: {
                timeslots: [{
                  start: { dateTime: searchStartDate.toISOString(), timeZone: 'UTC' },
                  end: { dateTime: searchEndDate.toISOString(), timeZone: 'UTC' }
                }],
                activityDomain: 'unrestricted' // Allow suggestions throughout the entire day, not just work hours
              },
              meetingDuration: `PT${durationMinutes}M`,
              maxCandidates: 50, // Request many more to ensure we have enough after filtering
              minimumAttendeePercentage: 100, // All attendees must be available
              isOrganizerOptional: false,
            });

            logger.log(`📊 Graph API returned ${findRes.meetingTimeSuggestions?.length || 0} suggestions`);

            // logger.log(findRes.meetingTimeSuggestions);

            // Filter out slots that are in the past and outside business hours
            const now = new Date();

            // Helper function to check if a slot overlaps with any busy calendar event
            const hasConflict = (slotStartTime: Date, slotEndTime: Date): boolean => {
              return scheduleResponse.value?.some((schedule: any) => {
                return schedule.scheduleItems?.some((item: any) => {
                  if (item.status !== 'busy' && item.status !== 'tentative') {
                    return false;
                  }

                  const itemStart = new Date(item.start.dateTime + (item.start.dateTime.endsWith('Z') ? '' : 'Z'));
                  const itemEnd = new Date(item.end.dateTime + (item.end.dateTime.endsWith('Z') ? '' : 'Z'));

                  // Two time ranges overlap if: start1 < end2 AND start2 < end1
                  const overlaps = slotStartTime < itemEnd && itemStart < slotEndTime;

                  if (overlaps) {
                    logger.log(`   ⚠️ Calendar conflict for ${schedule.scheduleId}: ${itemStart.toISOString()} - ${itemEnd.toISOString()}`);
                  }

                  return overlaps;
                });
              });
            };


            const businessHoursSlots = (findRes.meetingTimeSuggestions || [])
              .filter((slot: any) => {
                const slotStart = new Date(slot.meetingTimeSlot.start.dateTime);
                const slotEnd = new Date(slot.meetingTimeSlot.end.dateTime);

                // Filter out past times FIRST
                if (slotStart < now) {
                  logger.log(`⏭️ Skipping past slot: ${slotStart.toISOString()}`);
                  return false;
                }

                // CRITICAL: Manually check for conflicts using actual calendar data
                // Graph API's attendeeAvailability is unreliable with activityDomain: 'unrestricted'
                if (hasConflict(slotStart, slotEnd)) {
                  logger.log(`⏭️ Skipping slot with calendar conflict: ${slotStart.toISOString()} - ${slotEnd.toISOString()}`);
                  return false;
                }

                // Convert UTC to IST (UTC+5:30) by adding offset milliseconds
                // IST is UTC + 5 hours 30 minutes = 19800000 milliseconds
                const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
                const istTime = new Date(slotStart.getTime() + istOffset);
                const istHour = istTime.getUTCHours(); // Use getUTCHours() since we already added the offset

                // Business hours: 9 AM to 6 PM IST (in 24-hour format)
                const inBusinessHours = istHour >= 9 && istHour < 18;
                if (!inBusinessHours) {
                  logger.log(`⏭️ Skipping non-business hours slot: ${slotStart.toISOString()} (IST hour: ${istHour})`);
                }
                return inBusinessHours;
              })
              .map((slot: any) => {
                const slotStart = new Date(slot.meetingTimeSlot.start.dateTime);
                // Calculate time difference from requested slot (in minutes)
                const timeDiff = Math.abs(slotStart.getTime() - startTime.getTime()) / (1000 * 60);
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

                const aIsSameDay = sameDay(a.slotStart, startTime);
                const bIsSameDay = sameDay(b.slotStart, startTime);

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

            logger.log(`📋 After filtering: ${businessHoursSlots.length} slots remaining (from ${findRes.meetingTimeSuggestions?.length || 0} total)`);
            alternativeSlots = businessHoursSlots;
            logger.log(`✅ Returning ${alternativeSlots.length} alternative slots (filtered for future times + business hours, sorted by proximity)`);
          } catch (error) {
            logger.warn('Failed to find alternative slots:', error);
          }
        }
      } catch (error) {
        logger.warn('Failed to check availability:', error);
      }
    }

    return {
      isSlotBusy,
      availabilityStatus,
      alternativeSlots
    };
  }

  async parseNaturalLanguage(input: string, organizer?: string): Promise<any> {
    // Check if any LLM provider is available
    if (LLMProvider.getProvider() === 'none') {
      logger.warn('No LLM provider available - natural language parsing disabled');
      throw new Error('Natural language parsing requires an LLM API key (OpenAI, Azure OpenAI, or Groq). Please set one in .env.');
    }

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

      const model = LLMProvider.createChatModel({ task: 'extraction', temperature: 0.3 });

      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(input)
      ]);

      let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Clean up markdown code blocks if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const parsed = JSON.parse(content);

      // Validate that parsed times are in the future
      const now = new Date();
      const parsedStartTime = new Date(parsed.startTime);
      const parsedEndTime = new Date(parsed.endTime);

      if (parsedStartTime < now) {
        const istStartTime = parsedStartTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short'
        });
        throw new Error(`Cannot schedule meeting in the past. The requested start time (${istStartTime} IST) has already passed.`);
      }

      if (parsedEndTime < now) {
        const istEndTime = parsedEndTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short'
        });
        throw new Error(`Cannot schedule meeting in the past. The requested end time (${istEndTime} IST) has already passed.`);
      }

      if (parsedStartTime >= parsedEndTime) {
        throw new Error('End time must be after start time.');
      }

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
      const { isSlotBusy, availabilityStatus, alternativeSlots } = await this.checkAvailability(
        organizer,
        parsedStartTime,
        parsedEndTime,
        internal.map(a => a.emailAddress.address)
      );

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
      throw new Error(error ? String(error) : 'Failed to parse meeting details from input');
    }
  }
}
