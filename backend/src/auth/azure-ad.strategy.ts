import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwksClient from 'jwks-rsa';

@Injectable()
export class AzureADStrategy extends PassportStrategy(Strategy, 'azure-ad') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            audience: process.env.AZURE_CLIENT_ID,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
            algorithms: ['RS256'],
            secretOrKeyProvider: (request: any, rawJwtToken: any, done: any) => {
                const client = jwksClient({
                    jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
                });

                const getKey = (header: any, callback: (err: any, key?: any) => void) => {
                    client.getSigningKey(header.kid, (err: any, key: any) => {
                        if (err) {
                            return callback(err);
                        }
                        const signingKey = key?.getPublicKey();
                        callback(null, signingKey);
                    });
                };

                getKey(JSON.parse(Buffer.from(rawJwtToken.split('.')[0], 'base64').toString()), done);
            },
        });
    }

    async validate(payload: any) {
        if (!payload) {
            throw new UnauthorizedException('Invalid token');
        }

        // Extract user information from JWT payload
        return {
            userId: payload.oid || payload.sub,
            email: payload.preferred_username || payload.email || payload.upn,
            name: payload.name,
            tenantId: payload.tid,
        };
    }
}
