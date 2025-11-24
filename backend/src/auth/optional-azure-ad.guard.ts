import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional authentication guard - allows requests with or without authentication.
 * If authenticated, user info is available in req.user.
 * If not authenticated, req.user is undefined and system falls back to auto-detection.
 */
@Injectable()
export class OptionalAzureADGuard extends AuthGuard('azure-ad') {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            // Try to authenticate
            const result = await super.canActivate(context);
            console.log('✅ Authentication successful');
            return true;
        } catch (error: any) {
            // Authentication failed, but that's okay for optional guard
            console.log('⚠️ Authentication failed (optional, continuing):', error?.message || error);
            return true; // Allow request to proceed without authentication
        }
    }

    handleRequest(err: any, user: any, info: any) {
        // Don't throw error if no user - just return undefined
        // This allows the endpoint to work without authentication
        if (err) {
            console.warn('🔒 Optional auth error:', err.message);
        }
        if (info) {
            console.log('ℹ️ Auth info:', info.message || info);
        }
        if (user) {
            console.log('👤 Authenticated user:', user.email || user.userId);
        } else {
            console.log('🚫 No authenticated user, will use fallback');
        }
        return user; // Will be undefined if not authenticated
    }
}
