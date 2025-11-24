import { Body, Controller, Post } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SuggestRequestDTO, ScheduleRequestDTO } from './types';

@Controller('scheduling')
export class SchedulingController {
  constructor(private svc: SchedulingService) {}

  @Post('suggest')
  async suggest(@Body() dto: SuggestRequestDTO) {
    return this.svc.suggestSlots(dto);
  }

  @Post('schedule')
  async schedule(@Body() dto: ScheduleRequestDTO) {
    return this.svc.scheduleMeeting(dto);
  }
}
