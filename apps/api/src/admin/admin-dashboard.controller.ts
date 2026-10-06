import {
  Controller,
  Get,
  Header,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminPageAccess, bearerToken } from './admin-page.access';

@Controller('admin')
export class AdminDashboardController {
  constructor(
    private readonly access: AdminPageAccess,
    private readonly authService: AuthService,
  ) {}

  @Get('login')
  @Header('Cache-Control', 'no-store')
  login(@Res() res: Response) {
    this.sendHtml(res, 'login.html');
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async dashboard(@Req() req: Request, @Res() res: Response) {
    const access = await this.access.resolve(req);
    if (access === 'anonymous') {
      res.redirect(302, '/admin/login');
      return;
    }
    if (access === 'forbidden') {
      res.status(403).type('text').send('Admin access required');
      return;
    }
    this.sendHtml(res, 'index.html');
  }

  @Post('session')
  @UseGuards(JwtAuthGuard, AdminGuard)
  session(@Req() req: Request, @Res() res: Response) {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }
    this.access.setSession(res, token);
    res.status(204).send();
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = this.access.tokenFrom(req);
    if (token) {
      try {
        const session = await this.authService.authenticate(token);
        await this.authService.logout(session.sessionId);
      } catch {
        // The cookie is cleared either way.
      }
    }
    this.access.clearSession(res);
    res.status(204).send();
  }

  private sendHtml(res: Response, fileName: string) {
    const candidates = [
      join(__dirname, 'admin-ui', fileName),
      join(process.cwd(), 'src', 'admin', 'admin-ui', fileName),
    ];
    const file = candidates.find((path) => existsSync(path));
    if (!file) {
      res.status(500).type('text').send('Admin UI not found');
      return;
    }
    res.type('html').send(readFileSync(file, 'utf8'));
  }
}
