import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsBot } from './teams.bot';
import { LangchainModule } from '../langchain/langchain.module';

@Module({
    imports: [LangchainModule],
    controllers: [TeamsController],
    providers: [TeamsBot],
    exports: [TeamsBot]
})
export class TeamsModule { }
