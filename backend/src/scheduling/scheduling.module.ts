import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { GraphModule } from '../graph/graph.module';
import { AuthModule } from '../auth/auth.module';
import { AgentModule } from '../agent/agent.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, PrismaModule, GraphModule, AuthModule, AgentModule],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule { }
