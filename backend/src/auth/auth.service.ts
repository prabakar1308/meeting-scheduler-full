import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfidentialClientApplication, Configuration, ClientCredentialRequest } from '@azure/msal-node';
import Redis from 'ioredis';

const logger = new Logger('AuthService');

@Injectable()
export class AuthService implements OnModuleInit {
  private cca: ConfidentialClientApplication;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private redisClient: Redis | null = null;

  constructor() {
    this.tenantId = process.env.AZURE_TENANT_ID!;
    this.clientId = process.env.AZURE_CLIENT_ID!;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET!;
    this.scope = process.env.AZURE_SCOPE || 'https://graph.microsoft.com/.default';

    const config: Configuration = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        clientSecret: this.clientSecret,
      },
    };

    this.cca = new ConfidentialClientApplication(config);

    if (process.env.REDIS_URL) {
      this.redisClient = new Redis(process.env.REDIS_URL);
    }
  }

  onModuleInit() {
    logger.log('AuthService initialized');
  }

  private redisKeyForAppToken(): string {
    return `msal:appToken:${this.clientId}:${this.tenantId}`;
  }

  async getAppAccessToken(): Promise<{ accessToken: string; expiresOn: number }> {
    if (this.redisClient) {
      const key = this.redisKeyForAppToken();
      const cached = await this.redisClient.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.expiresOn && parsed.expiresOn > Date.now() + 5000) {
          return parsed;
        }
      }
    }

    const request: ClientCredentialRequest = {
      scopes: [this.scope],
    };

    const resp = await this.cca.acquireTokenByClientCredential(request);
    if (!resp || !resp.accessToken || !resp.expiresOn) {
      throw new Error('Failed to acquire access token via MSAL');
    }

    const tokenInfo = {
      accessToken: resp.accessToken,
      expiresOn: resp.expiresOn.getTime(),
    };

    if (this.redisClient) {
      const ttlSec = Math.max(1, Math.floor((tokenInfo.expiresOn - Date.now()) / 1000) - 10);
      await this.redisClient.set(this.redisKeyForAppToken(), JSON.stringify(tokenInfo), 'EX', ttlSec);
    }

    return tokenInfo;
  }
}
