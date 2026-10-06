import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

export const ADMIN_COOKIE = 'rc_admin';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Access = 'ok' | 'anonymous' | 'forbidden';

@Injectable()
export class AdminPageAccess {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  tokenFrom(request: Request) {
    return bearerToken(request) || readCookie(request, ADMIN_COOKIE);
  }

  async resolve(request: Request): Promise<Access> {
    const token = this.tokenFrom(request);
    if (!token) {
      return 'anonymous';
    }

    try {
      const payload = await this.auth.authenticate(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      });
      if (!user) {
        return 'anonymous';
      }
      if (user.role !== 'ADMIN') {
        return 'forbidden';
      }
      return 'ok';
    } catch {
      return 'anonymous';
    }
  }

  setSession(response: Response, token: string) {
    response.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/admin',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  clearSession(response: Response) {
    response.clearCookie(ADMIN_COOKIE, { path: '/admin' });
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
