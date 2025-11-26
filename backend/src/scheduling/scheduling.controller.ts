import { Body, Controller, Post, UseGuards, Request, HttpException } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SuggestRequestDTO, ScheduleRequestDTO } from './types';
import { OptionalAzureADGuard } from '../auth/optional-azure-ad.guard';

@Controller('scheduling')
export class SchedulingController {
  constructor(private svc: SchedulingService) { }

  @Post('suggest')
  @UseGuards(OptionalAzureADGuard)
  async suggest(@Body() dto: SuggestRequestDTO, @Request() req: any) {
    // If user is authenticated, use their email from JWT token
    // Otherwise, system will auto-detect from Graph API
    const userEmail = req.user?.email;
    return this.svc.suggestSlots({ ...dto, organizer: userEmail || dto.organizer });
  }

  @Post('schedule')
  @UseGuards(OptionalAzureADGuard)
  async schedule(@Body() dto: ScheduleRequestDTO, @Request() req: any) {
    // If user is authenticated, use their email from JWT token
    // Otherwise, system will auto-detect from Graph API
    const userEmail = req.user?.email;
    console.log('🔐 Authenticated user email from JWT:', userEmail);
    console.log('📧 Request body organizer:', dto.organizer);
    if (userEmail) {
      dto.organizer = userEmail;
      console.log('✅ Set organizer to signed-in user:', dto.organizer);
    }
    return this.svc.scheduleMeeting(dto);
  }

  @Post('parse-natural-language')
  @UseGuards(OptionalAzureADGuard)
  async parseNaturalLanguage(@Body() dto: { naturalLanguageInput: string }, @Request() req: any) {
    try {
      const userEmail = req.user?.email;
      return await this.svc.parseNaturalLanguage(dto.naturalLanguageInput, userEmail);
    } catch (error: any) {
      console.log(error)
      throw new HttpException(
        error.message || 'Failed to parse natural language input',
        error.status || 400
      );
    }
  }
}
