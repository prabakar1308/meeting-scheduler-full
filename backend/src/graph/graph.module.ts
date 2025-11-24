import { Module } from '@nestjs/common';
import { GraphClient } from './graph.client';
import { AuthService } from '../auth/auth.service';
import { UserSyncService } from '../user-sync/user-sync.service';

@Module({
  providers: [AuthService, GraphClient, UserSyncService],
  exports: [GraphClient, UserSyncService],
})
export class GraphModule {}
