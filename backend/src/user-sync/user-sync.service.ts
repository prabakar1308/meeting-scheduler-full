import { Injectable, Logger } from '@nestjs/common';
import { GraphClient } from '../graph/graph.client';
const logger = new Logger('UserSyncService');

@Injectable()
export class UserSyncService {
  constructor(private graph: GraphClient) { }

  async syncAllUsers(prisma: any) {
    const graphUsers = await this.graph.listUsers(100);
    logger.log(`Fetched ${graphUsers.length} users from Graph`);
    for (const gu of graphUsers) {
      try {
        await prisma.user.upsert({
          where: { azureId: gu.id },
          update: {
            displayName: gu.displayName ?? gu.userPrincipalName ?? null,
            email: gu.mail ?? gu.userPrincipalName ?? null,
          },
          create: {
            azureId: gu.id,
            displayName: gu.displayName ?? gu.userPrincipalName ?? null,
            email: gu.mail ?? gu.userPrincipalName ?? null,
          }
        });
      } catch (e) {
        logger.warn(`Failed to upsert user ${gu?.id}: ${(e as any)?.message ?? e}`);
      }
    }
  }

  async ensureUserInPrisma(prisma: any, userPrincipalNameOrId: string) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ azureId: userPrincipalNameOrId }, { email: userPrincipalNameOrId }] } });
    if (existing) return existing;
    const gu = await this.graph.getUserById(userPrincipalNameOrId);
    if (!gu) return null;
    const up = await prisma.user.upsert({
      where: { azureId: gu.id },
      update: { displayName: gu.displayName ?? gu.userPrincipalName, email: gu.mail ?? gu.userPrincipalName },
      create: { azureId: gu.id, displayName: gu.displayName ?? gu.userPrincipalName, email: gu.mail ?? gu.userPrincipalName }
    });
    return up;
  }
}
