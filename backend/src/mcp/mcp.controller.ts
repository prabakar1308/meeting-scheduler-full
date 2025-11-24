import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
    constructor(private mcpService: McpService) { }

    @Get('sse')
    async handleSSE(@Req() req: Request, @Res() res: Response) {
        await this.mcpService.handleSSE(req, res);
    }

    @Post('messages')
    async handleMessage(@Req() req: Request, @Res() res: Response) {
        await this.mcpService.handleMessage(req, res);
    }
}
