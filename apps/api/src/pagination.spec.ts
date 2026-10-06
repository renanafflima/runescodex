import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { LIMIT_DEFAULT, LIMIT_MAX } from './common/pagination';
import { PageQueryDto } from './common/dto/page-query.dto';
import { BestiaryService } from './bestiary/bestiary.service';
import { ForumService } from './forum/forum.service';
import { HuntsService } from './hunts/hunts.service';
import { PrismaService } from './prisma/prisma.service';
import { RewardsService } from './rewards/rewards.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('./rewards/rewards.service', () => ({
  RewardsService: class RewardsService {},
}));

function thread(index: number) {
  return {
    id: `thread-${index}`,
    title: `Topic ${index}`,
    body: 'Body',
    status: 'OPEN',
    createdAt: new Date(2026, 0, index + 1),
    updatedAt: new Date(2026, 0, index + 1),
    author: { id: 'user-1' },
    replies: Array.from({ length: 8 }, (_, reply) => ({
      id: `reply-${index}-${reply}`,
      body: `Comment ${reply}`,
      createdAt: new Date(2026, 1, reply + 1),
      updatedAt: new Date(2026, 1, reply + 1),
      author: { id: 'user-1' },
    })),
    _count: { replies: 8 },
  };
}

function hunt(index: number) {
  return {
    id: `hunt-${index}`,
    name: `Hunt ${String(index).padStart(2, '0')}`,
    slug: `hunt-${index}`,
    location: 'Thais',
    subLocation: null,
    difficulty: 'EASY',
    respawn: null,
    heroImage: null,
    mapImage: null,
    vocations: [],
    creatures: [],
  };
}

function bestiary(index: number) {
  return {
    id: `creature-${index}`,
    name: `Creature ${index}`,
    slug: `creature-${index}`,
    image: 'creature.gif',
    hp: 10,
    experience: null,
    difficulty: 'EASY',
    youtubeUrl: null,
    elements: [],
    locations: [],
    togetherFrom: [],
    bestiaryEntry: {
      category: null,
      killsRequired: 100,
      estimatedKillsPerHour: 50,
      charmPoints: null,
    },
  };
}

function paged(rows: unknown[]) {
  return {
    count: async () => rows.length,
    findMany: async ({
      skip = 0,
      take = LIMIT_DEFAULT,
    }: {
      skip?: number;
      take?: number;
    }) => rows.slice(skip, skip + take),
  };
}

async function expectInvalidLimit(dto: new () => object) {
  const zero = plainToInstance(dto, { limit: 0 });
  const huge = plainToInstance(dto, { limit: LIMIT_MAX + 1 });
  const text = plainToInstance(dto, { limit: 'many' });
  expect(await validate(zero)).not.toHaveLength(0);
  expect(await validate(huge)).not.toHaveLength(0);
  expect(await validate(text)).not.toHaveLength(0);
}

describe('list pagination', () => {
  it('rejects an invalid limit on every list endpoint', async () => {
    await expectInvalidLimit(PageQueryDto);
    for (const file of [
      'forum/dto/list-forum-query.dto.ts',
      'hunts/dto/list-hunts-query.dto.ts',
      'bestiary/dto/list-bestiary-query.dto.ts',
    ]) {
      expect(readFileSync(join(__dirname, file), 'utf8')).toContain(
        'extends PageQueryDto',
      );
    }
  });

  it('pages forum topics and keeps reply previews bounded', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => thread(index));
    const forumThread = {
      ...paged(rows),
      findMany: async ({
        skip = 0,
        take = LIMIT_DEFAULT,
        include,
      }: {
        skip?: number;
        take?: number;
        include?: { replies?: { take?: number } };
      }) =>
        rows.slice(skip, skip + take).map((row) => ({
          ...row,
          replies: row.replies.slice(
            0,
            include?.replies?.take ?? row.replies.length,
          ),
        })),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: PrismaService, useValue: { forumThread } },
        { provide: RewardsService, useValue: {} },
      ],
    }).compile();
    const service = moduleRef.get(ForumService);

    const first = await service.findAll({});
    const second = await service.findAll({ page: 2 });
    const last = await service.findAll({ page: 2, limit: 20 });
    const custom = await service.findAll({ limit: 10 });
    const capped = await service.findAll({ limit: 500 });

    expect(first.page).toBe(1);
    expect(first.limit).toBe(LIMIT_DEFAULT);
    expect(first.items).toHaveLength(LIMIT_DEFAULT);
    expect(first.total).toBe(25);
    expect(first.hasMore).toBe(true);
    expect(first.items[0].comments.length).toBeLessThanOrEqual(5);
    expect(second.page).toBe(2);
    expect(second.items).toHaveLength(5);
    expect(second.items[0].id).toBe('thread-20');
    expect(last.hasMore).toBe(false);
    expect(custom.items).toHaveLength(10);
    expect(custom.limit).toBe(10);
    expect(capped.limit).toBe(LIMIT_MAX);
    expect(capped.items).toHaveLength(25);

    forumThread.count = async () => 0;
    forumThread.findMany = async () => [];
    const none = await service.findAll({});
    expect(none).toEqual({
      items: [],
      page: 1,
      limit: LIMIT_DEFAULT,
      total: 0,
      hasMore: false,
    });
  });

  it('pages hunts without returning the whole table by default', async () => {
    const rows = Array.from({ length: 45 }, (_, index) => hunt(index));
    const huntModel = paged(rows);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HuntsService,
        { provide: PrismaService, useValue: { hunt: huntModel } },
      ],
    }).compile();
    const service = moduleRef.get(HuntsService);

    const first = await service.findAll({});
    const second = await service.findAll({ page: 2, limit: 20 });
    const last = await service.findAll({ page: 3, limit: 20 });
    const capped = await service.findAll({ limit: 80 });

    expect(first.items).toHaveLength(LIMIT_DEFAULT);
    expect(first.hasMore).toBe(true);
    expect(second.items[0].id).toBe('hunt-20');
    expect(last.items).toHaveLength(5);
    expect(last.hasMore).toBe(false);
    expect(capped.limit).toBe(LIMIT_MAX);
    expect(capped.items).toHaveLength(45);

    huntModel.count = async () => 0;
    huntModel.findMany = async () => [];
    const none = await service.findAll({});
    expect(none.items).toEqual([]);
    expect(none.total).toBe(0);
    expect(none.hasMore).toBe(false);
  });

  it('pages bestiary entries and keeps the list payload', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => bestiary(index));
    const creature = paged(rows);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BestiaryService,
        { provide: PrismaService, useValue: { creature } },
      ],
    }).compile();
    const service = moduleRef.get(BestiaryService);

    const first = await service.findAll({});
    const second = await service.findAll({ page: 2 });
    const capped = await service.findAll({ limit: 200 });

    expect(first.items).toHaveLength(LIMIT_DEFAULT);
    expect(first.items[0]).toEqual(
      expect.objectContaining({
        slug: 'creature-0',
        killsRequired: 100,
        elements: [],
        locations: [],
        together: [],
      }),
    );
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect(capped.limit).toBe(LIMIT_MAX);
    expect(capped.items).toHaveLength(21);

    creature.count = async () => 0;
    creature.findMany = async () => [];
    const none = await service.findAll({});
    expect(none.items).toEqual([]);
    expect(none.hasMore).toBe(false);
  });
});
