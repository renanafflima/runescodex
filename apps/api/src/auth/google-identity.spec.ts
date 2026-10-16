import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import {
  GoogleIdentityService,
  readGoogleIdentity,
} from './google-identity';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

const CLIENT_ID = 'client.apps.googleusercontent.com';
const NOW = Date.parse('2026-10-15T12:00:00.000Z');

function payload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-subject',
    email: 'User@Email.com',
    email_verified: true,
    exp: Math.floor(NOW / 1000) + 60,
    iat: Math.floor(NOW / 1000),
    ...overrides,
  };
}

describe('readGoogleIdentity', () => {
  it('accepts a verified token for the configured audience', () => {
    expect(readGoogleIdentity(payload(), CLIENT_ID, NOW)).toEqual({
      sub: 'google-subject',
      email: 'user@email.com',
    });
  });

  it.each([
    ['missing payload', undefined],
    ['wrong audience', payload({ aud: 'other-client' })],
    ['wrong issuer', payload({ iss: 'https://evil.example' })],
    ['expired token', payload({ exp: Math.floor(NOW / 1000) - 1 })],
    ['missing subject', payload({ sub: '' })],
  ])('rejects an invalid credential: %s', (_label, value) => {
    expect(() => readGoogleIdentity(value, CLIENT_ID, NOW)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unverified email', () => {
    expect(() =>
      readGoogleIdentity(payload({ email_verified: false }), CLIENT_ID, NOW),
    ).toThrow('Google email is not verified');
  });
});

describe('GoogleIdentityService', () => {
  const verifyIdToken = jest.fn();

  beforeEach(() => {
    verifyIdToken.mockReset();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      verifyIdToken,
    }));
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('rejects a token the Google library will not verify', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad signature'));
    const service = new GoogleIdentityService();

    await expect(service.verify('not-a-jwt')).rejects.toThrow(
      'Invalid Google credential',
    );
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'not-a-jwt',
      audience: CLIENT_ID,
    });
  });

  it('rejects an unverified email returned by Google', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () =>
        payload({
          email_verified: false,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
    });
    const service = new GoogleIdentityService();

    await expect(service.verify('signed-token')).rejects.toThrow(
      'Google email is not verified',
    );
  });
});
