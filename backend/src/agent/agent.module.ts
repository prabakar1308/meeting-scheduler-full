import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { LangGraphDependencies } from './deps';

@Module({
  providers: [AgentService, LangGraphDependencies],
  exports: [AgentService],
})
export class AgentModule {}
