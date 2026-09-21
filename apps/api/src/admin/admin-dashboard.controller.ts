import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Controller('admin')
export class AdminDashboardController {
  @Get()
  @Header('Cache-Control', 'no-store')
  dashboard(@Res() res: Response) {
    const candidates = [
      join(__dirname, 'admin-ui', 'index.html'),
      join(process.cwd(), 'src', 'admin', 'admin-ui', 'index.html'),
    ];
    const file = candidates.find((path) => existsSync(path));
    if (!file) {
      res.status(500).type('text').send('Admin UI not found');
      return;
    }
    res.type('html').send(readFileSync(file, 'utf8'));
  }
}
