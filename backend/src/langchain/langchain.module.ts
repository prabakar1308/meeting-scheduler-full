import { Module } from '@nestjs/common';
import { ConversationalService } from './conversational.service';
import { LangchainController } from './langchain.controller';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
    imports: [SchedulingModule],
    controllers: [LangchainController],
    providers: [ConversationalService],
    exports: [ConversationalService],
})
export class LangchainModule { }
