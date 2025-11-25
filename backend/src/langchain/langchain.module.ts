import { Module } from '@nestjs/common';
import { ConversationalService } from './conversational.service';

@Module({
    providers: [ConversationalService],
    exports: [ConversationalService],
})
export class LangchainModule { }
