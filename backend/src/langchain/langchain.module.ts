import { Module } from '@nestjs/common';
import { ConversationalService } from './conversational.service';
import { LangchainController } from './langchain.controller';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { GraphModule } from '../graph/graph.module';

@Module({
    imports: [SchedulingModule, GraphModule],
    controllers: [LangchainController],
    providers: [ConversationalService],
    exports: [ConversationalService],
})
export class LangchainModule { }
