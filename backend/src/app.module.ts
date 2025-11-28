import { Module } from '@nestjs/common';
import { SchedulingModule } from './scheduling/scheduling.module';
import { PrismaModule } from './prisma/prisma.module';
import { GraphModule } from './graph/graph.module';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';
import { LangchainModule } from './langchain/langchain.module';

import { McpModule } from './mcp/mcp.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [PrismaModule, AuthModule, GraphModule, AgentModule, SchedulingModule, LangchainModule, McpModule, TeamsModule],
})
export class AppModule { }
