import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SuggestRequestDTO, ScheduleRequestDTO } from './types';
import { OptionalAzureADGuard } from '../auth/optional-azure-ad.guard';

@Controller('scheduling')
@UseGuards(OptionalAzureADGuard) // Optional authentication - works with or without token
export class SchedulingController {
  constructor(private svc: SchedulingService) { }

  @Post('suggest')
  async suggest(@Body() dto: SuggestRequestDTO, @Request() req: any) {
    // If user is authenticated, use their email from JWT token
    // Otherwise, system will auto-detect from Graph API
    const userEmail = req.user?.email;
    return this.svc.suggestSlots({ ...dto, organizer: userEmail || dto.organizer });
  }

  @Post('schedule')
  async schedule(@Body() dto: ScheduleRequestDTO, @Request() req: any) {
    // If user is authenticated, use their email from JWT token
    // Otherwise, system will auto-detect from Graph API
    const userEmail = req.user?.email;
    return this.svc.scheduleMeeting({ ...dto, organizer: userEmail || dto.organizer });
  }
}
