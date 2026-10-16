import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

const GOOGLE_ISSUERS = new Set([
  'accounts.google.com',
  'https://accounts.google.com',
]);

export type GoogleIdentity = {
  sub: string;
  email: string;
};

export function readGoogleIdentity(
  payload: TokenPayload | undefined,
  clientId: string,
  nowMs = Date.now(),
): GoogleIdentity {
  if (!payload?.sub || !payload.email?.trim()) {
    throw new UnauthorizedException('Invalid Google credential');
  }
  const audiences = Array.isArray(payload.aud)
    ? payload.aud
    : payload.aud
      ? [payload.aud]
      : [];
  if (!audiences.includes(clientId)) {
    throw new UnauthorizedException('Invalid Google credential');
  }
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new UnauthorizedException('Invalid Google credential');
  }
  if (!payload.exp || payload.exp * 1000 <= nowMs) {
    throw new UnauthorizedException('Invalid Google credential');
  }
  if (payload.email_verified !== true) {
    throw new UnauthorizedException('Google email is not verified');
  }
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
  };
}

@Injectable()
export class GoogleIdentityService {
  async verify(idToken: string): Promise<GoogleIdentity> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }
    const client = new OAuth2Client(clientId);
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      return readGoogleIdentity(ticket.getPayload(), clientId);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Google credential');
    }
  }
}
