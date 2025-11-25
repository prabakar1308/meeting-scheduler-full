import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
    imports: [SchedulingModule],
    controllers: [McpController],
    providers: [McpService],
    exports: [McpService], // Export for use in other modules
})
export class McpModule { }
