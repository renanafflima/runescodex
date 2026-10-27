import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminSettingsService } from '../settings/admin-settings.service';
import { AdminInsightsService } from './admin-insights.service';

describe('AdminInsightsService search', () => {
  it('returns typed hits and ignores a one-character query', async () => {
    const prisma = {
      user: {
        findMany: jest.fn(async () => [
          {
            id: 'user-1',
            email: 'ada@example.com',
            activeCharacter: { name: 'Ada' },
          },
        ]),
      },
      creature: {
        findMany: jest.fn(async () => [
          { id: 'creature-1', name: 'Dragon', slug: 'dragon' },
        ]),
      },
      hunt: {
        findMany: jest.fn(async () => [
          { id: 'hunt-1', name: 'Dragon Lair', slug: 'dragon-lair' },
        ]),
      },
      ticket: {
        findMany: jest.fn(async () => [
          { id: 'ticket-1', protocol: 'RC-DRAGON01', status: 'OPEN' },
        ]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminInsightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminSettingsService, useValue: {} },
      ],
    }).compile();
    const service = moduleRef.get(AdminInsightsService);

    await expect(service.search('a')).resolves.toEqual({ items: [] });
    expect(prisma.user.findMany).not.toHaveBeenCalled();

    const result = await service.search('dra');
    expect(result.items).toEqual([
      { type: 'user', id: 'user-1', label: 'Ada', href: '/admin/users/user-1' },
      {
        type: 'creature',
        id: 'creature-1',
        label: 'Dragon',
        href: '/admin/bestiary?search=Dragon',
      },
      {
        type: 'hunt',
        id: 'hunt-1',
        label: 'Dragon Lair',
        href: '/admin/hunts?search=Dragon%20Lair',
      },
      {
        type: 'ticket',
        id: 'ticket-1',
        label: 'RC-DRAGON01',
        href: '/admin/tickets/ticket-1',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('password');
  });
});
