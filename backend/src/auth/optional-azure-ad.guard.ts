import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional authentication guard - allows requests with or without authentication.
 * If authenticated, user info is available in req.user.
 * If not authenticated, req.user is undefined and system falls back to auto-detection.
 */
@Injectable()
export class OptionalAzureADGuard extends AuthGuard('azure-ad') {
    canActivate(context: ExecutionContext) {
        // Always return true - authentication is optional
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any) {
        // Don't throw error if no user - just return undefined
        // This allows the endpoint to work without authentication
        if (err) {
            console.warn('Optional auth failed:', err.message);
        }
        return user; // Will be undefined if not authenticated
    }
}
