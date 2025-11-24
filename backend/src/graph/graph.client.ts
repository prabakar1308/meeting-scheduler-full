import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

const logger = new Logger('GraphClient');

@Injectable()
export class GraphClient {
  private client: AxiosInstance;

  constructor(private auth: AuthService) {
    this.client = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async withAuthHeaders() {
    const token = await this.auth.getAppAccessToken();
    return { Authorization: `Bearer ${token.accessToken}` };
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  async requestWithRetry<T = any>(fn: () => Promise<AxiosResponse<T>>, maxRetries = 5): Promise<AxiosResponse<T>> {
    let attempt = 0;
    let lastErr: any = null;
    while (attempt <= maxRetries) {
      try {
        const resp = await fn();
        return resp;
      } catch (err: any) {
        lastErr = err;
        attempt++;
        const status = err?.response?.status;
        const retryAfterRaw = err?.response?.headers?.['retry-after'];
        let waitMs = Math.min(60000, 1000 * Math.pow(2, attempt));
        if (retryAfterRaw) {
          const s = parseInt(retryAfterRaw, 10);
          if (!isNaN(s)) waitMs = s * 1000;
          else {
            const dt = Date.parse(retryAfterRaw);
            if (!isNaN(dt)) waitMs = Math.max(0, dt - Date.now());
          }
        }
        if ([429, 503].includes(status)) {
          logger.warn(`Graph throttled (status=${status}). retry #${attempt} after ${waitMs}ms`);
          await this.sleep(waitMs);
          continue;
        }
        if (status >= 500 && status < 600) {
          logger.warn(`Transient server error ${status}. retry #${attempt} after ${waitMs}ms`);
          await this.sleep(waitMs);
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  async getPaged<T = any>(url: string, params?: any): Promise<T[]> {
    let next = url;
    const results: T[] = [];
    while (next) {
      const headers = await this.withAuthHeaders();
      const resp = await this.requestWithRetry(() => this.client.get(next, { headers, params }));
      const data = resp.data;
      if (Array.isArray(data.value)) results.push(...data.value);
      else results.push(data as unknown as T);
      if (data['@odata.nextLink']) {
        next = data['@odata.nextLink'];
        params = undefined;
      } else next = undefined as any;
    }
    return results;
  }

  async getUserById(userIdOrPrincipalName: string) {
    const headers = await this.withAuthHeaders();
    const resp = await this.requestWithRetry(() => this.client.get(`/users/${encodeURIComponent(userIdOrPrincipalName)}`, { headers, params: { '$select': 'id,displayName,mail,userPrincipalName' } }));
    return resp.data;
  }

  async listUsers(top = 100) {
    return this.getPaged('/users', { $top: top, $select: 'id,displayName,mail,userPrincipalName' });
  }

  async findMeetingTimes(organizerUPN: string, attendees: any[], options: any) {
    const headers = await this.withAuthHeaders();
    const resp = await this.requestWithRetry(() => this.client.post(`/users/${encodeURIComponent(organizerUPN)}/findMeetingTimes`, options, { headers }));
    return resp.data;
  }

  async createEventForUser(userPrincipalName: string, eventPayload: any) {
    const headers = await this.withAuthHeaders();
    const resp = await this.requestWithRetry(() => this.client.post(`/users/${encodeURIComponent(userPrincipalName)}/events`, eventPayload, { headers }));
    return resp.data;
  }

  /**
   * Get the authenticated user's email from Microsoft Graph.
   * This uses the app's credentials to determine the default organizer.
   * Falls back to environment variable if Graph call fails.
   */
  async getAuthenticatedUserEmail(): Promise<string> {
    try {
      // Try to get the first user from the organization as the default organizer
      // In a real scenario, you might want to configure a specific user ID
      const defaultUserId = process.env.DEFAULT_ORGANIZER_USER_ID;

      if (defaultUserId) {
        const user = await this.getUserById(defaultUserId);
        return user.mail || user.userPrincipalName;
      }

      // Fallback: get the first admin user or any user
      const users = await this.listUsers(1);
      if (users && users.length > 0) {
        const user = users[0];
        logger.log(`Using first available user as organizer: ${user.mail || user.userPrincipalName}`);
        return user.mail || user.userPrincipalName;
      }

      throw new Error('No users found in organization');
    } catch (error) {
      logger.error('Failed to fetch authenticated user from Graph API:', error);

      // Fallback to environment variable
      const fallbackEmail = process.env.DEFAULT_ORGANIZER_EMAIL;
      if (fallbackEmail) {
        logger.warn(`Using fallback organizer email from env: ${fallbackEmail}`);
        return fallbackEmail;
      }

      throw new Error('Could not determine organizer email. Set DEFAULT_ORGANIZER_EMAIL or DEFAULT_ORGANIZER_USER_ID in .env');
    }
  }
}
