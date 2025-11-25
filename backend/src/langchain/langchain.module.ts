import { Module } from '@nestjs/common';
import { ConversationalService } from './conversational.service';
import { LangchainController } from './langchain.controller';
import { McpAgentService } from './mcp-agent.service';
import { McpAgentController } from './mcp-agent.controller';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { GraphModule } from '../graph/graph.module';
import { McpModule } from '../mcp/mcp.module';

@Module({
    imports: [SchedulingModule, GraphModule, McpModule],
    controllers: [LangchainController, McpAgentController],
    providers: [ConversationalService, McpAgentService],
    exports: [ConversationalService, McpAgentService],
})
export class LangchainModule { }
