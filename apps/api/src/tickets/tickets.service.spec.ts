import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStorageNotConfiguredError } from './storage/ticket-storage';
import { TicketsService } from './tickets.service';
import { TICKET_EVIDENCE_MAX_BYTES, TICKET_STORAGE } from './tickets.constants';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const HUNT_ID = '44444444-4444-4444-8444-444444444444';
const CREATURE_ID = '55555555-5555-4555-8555-555555555555';
const TICKET_ID = '66666666-6666-4666-8666-666666666666';
const EVIDENCE_ID = '77777777-7777-4777-8777-777777777777';
const MAX_BYTES = 64;

function jpeg(size = 16) {
  const bytes = Buffer.alloc(size, 0);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    authorId: USER_ID,
    status: 'OPEN',
    problemType: 'OTHER',
    impact: 'LOW',
    origin: 'GENERAL',
    description: 'Something is wrong',
    playerLevel: null,
    partyFormat: null,
    catalogValue: null,
    userValue: null,
    resolutionNote: null,
    resolvedByUserId: null,
    resolvedAt: null,
    rewardPoints: null,
    rewardGrantedAt: null,
    createdAt: new Date('2026-09-30T00:00:00.000Z'),
    updatedAt: new Date('2026-09-30T00:00:00.000Z'),
    author: { id: USER_ID },
    hunt: null,
    creature: null,
    vocations: [],
    evidences: [],
    ...overrides,
  };
}

describe('TicketsService', () => {
  let service: TicketsService;
  const prisma = {
    user: { findUnique: jest.fn() },
    hunt: { findUnique: jest.fn() },
    creature: { findUnique: jest.fn() },
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ticketEvidence: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const storage = {
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.hunt.findUnique.mockResolvedValue({ id: HUNT_ID });
    prisma.creature.findUnique.mockResolvedValue({ id: CREATURE_ID });
    prisma.ticket.count.mockResolvedValue(1);
    prisma.ticketEvidence.count.mockResolvedValue(0);
    storage.put.mockImplementation(
      (object: { storageKey: string; body: Buffer; mimeType: string }) =>
        Promise.resolve({
          storageKey: object.storageKey,
          url: `https://cdn.example/${object.storageKey}`,
        }),
    );
    storage.delete.mockResolvedValue(undefined);
    storage.get.mockResolvedValue(jpeg());
    const moduleRef = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TICKET_STORAGE, useValue: storage },
        { provide: TICKET_EVIDENCE_MAX_BYTES, useValue: MAX_BYTES },
      ],
    }).compile();
    service = moduleRef.get(TicketsService);
  });

  it('creates an authenticated ticket as OPEN without a reputation grant', async () => {
    prisma.ticket.create.mockResolvedValue(ticketRow());

    const result = await service.create(USER_ID, {
      problemType: 'OTHER',
      impact: 'LOW',
      origin: 'GENERAL',
      description: ' Something is wrong ',
    });

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: USER_ID,
          status: 'OPEN',
          problemType: 'OTHER',
          impact: 'LOW',
          origin: 'GENERAL',
          description: 'Something is wrong',
          huntId: null,
          creatureId: null,
          playerLevel: null,
          partyFormat: null,
          catalogValue: null,
          userValue: null,
        },
      }),
    );
    expect(result.status).toBe('OPEN');
    expect(result.authorId).toBe(USER_ID);
    expect(result.rewardPoints).toBeNull();
    expect(result.rewardGrantedAt).toBeNull();
  });

  it('rejects a hunt that does not exist', async () => {
    prisma.hunt.findUnique.mockResolvedValue(null);

    await expect(
      service.create(USER_ID, {
        problemType: 'XP_PER_HOUR',
        impact: 'MEDIUM',
        origin: 'HUNT',
        description: 'XP looks wrong',
        huntId: HUNT_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects a creature that does not exist', async () => {
    prisma.creature.findUnique.mockResolvedValue(null);

    await expect(
      service.create(USER_ID, {
        problemType: 'BESTIARY',
        impact: 'INCORRECT_INFO',
        origin: 'BESTIARY',
        description: 'Bestiary is wrong',
        creatureId: CREATURE_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('creates a hunt ticket with structured context and evidence references', async () => {
    prisma.ticket.create.mockResolvedValue(
      ticketRow({
        problemType: 'XP_PER_HOUR',
        origin: 'HUNT',
        hunt: { id: HUNT_ID, name: 'Ancient Scarabs', slug: 'ancient-scarabs' },
        creature: {
          id: CREATURE_ID,
          name: 'Ancient Scarab',
          slug: 'ancient-scarab',
        },
        playerLevel: 250,
        partyFormat: 'PT_4',
        catalogValue: '4.5kk',
        userValue: '3.1kk',
        vocations: [
          { vocation: 'EK' },
          { vocation: 'ED' },
          { vocation: 'MS' },
          { vocation: 'RP' },
        ],
        evidences: [
          {
            id: 'evidence-1',
            storageKey: 'tickets/user/photo.jpg',
            url: 'https://cdn.example.com/tickets/photo.jpg',
            mimeType: 'image/jpeg',
            source: 'CAMERA',
            byteSize: 1200,
            createdAt: new Date('2026-09-30T00:00:00.000Z'),
          },
        ],
      }),
    );

    const result = await service.create(USER_ID, {
      problemType: 'XP_PER_HOUR',
      impact: 'HIGH',
      origin: 'HUNT',
      description: 'XP/h is too high',
      huntId: HUNT_ID,
      creatureId: CREATURE_ID,
      playerLevel: 250,
      partyFormat: 'PT_4',
      vocations: ['EK', 'ED', 'MS', 'RP'],
      catalogValue: '4.5kk',
      userValue: '3.1kk',
      evidences: [
        {
          storageKey: 'tickets/user/photo.jpg',
          url: 'https://cdn.example.com/tickets/photo.jpg',
          mimeType: 'image/jpeg',
          source: 'CAMERA',
          byteSize: 1200,
        },
      ],
    });

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: USER_ID,
          status: 'OPEN',
          problemType: 'XP_PER_HOUR',
          impact: 'HIGH',
          origin: 'HUNT',
          description: 'XP/h is too high',
          huntId: HUNT_ID,
          creatureId: CREATURE_ID,
          playerLevel: 250,
          partyFormat: 'PT_4',
          catalogValue: '4.5kk',
          userValue: '3.1kk',
          vocations: {
            create: [
              { vocation: 'EK' },
              { vocation: 'ED' },
              { vocation: 'MS' },
              { vocation: 'RP' },
            ],
          },
          evidences: {
            create: [
              {
                storageKey: 'tickets/user/photo.jpg',
                url: 'https://cdn.example.com/tickets/photo.jpg',
                mimeType: 'image/jpeg',
                source: 'CAMERA',
                byteSize: 1200,
              },
            ],
          },
        },
      }),
    );
    expect(prisma.hunt.findUnique).toHaveBeenCalledWith({
      where: { id: HUNT_ID },
      select: { id: true },
    });
    expect(prisma.creature.findUnique).toHaveBeenCalledWith({
      where: { id: CREATURE_ID },
      select: { id: true },
    });
    expect(result.hunt).toEqual({
      id: HUNT_ID,
      name: 'Ancient Scarabs',
      slug: 'ancient-scarabs',
    });
    expect(result.playerLevel).toBe(250);
    expect(result.partyFormat).toBe('PT_4');
    expect(result.vocations).toEqual(['EK', 'ED', 'MS', 'RP']);
    expect(result.catalogValue).toBe('4.5kk');
    expect(result.userValue).toBe('3.1kk');
    expect(result.evidences[0].storageKey).toBe('tickets/user/photo.jpg');
    expect(JSON.stringify(result)).not.toContain('base64');
  });

  it('creates a ticket without a hunt when the problem type allows it', async () => {
    prisma.ticket.create.mockResolvedValue(ticketRow());

    await service.create(USER_ID, {
      problemType: 'OTHER',
      impact: 'LOW',
      origin: 'GENERAL',
      description: 'General report',
    });

    expect(prisma.hunt.findUnique).not.toHaveBeenCalled();
    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: USER_ID,
          status: 'OPEN',
          problemType: 'OTHER',
          impact: 'LOW',
          origin: 'GENERAL',
          description: 'General report',
          huntId: null,
          creatureId: null,
          playerLevel: null,
          partyFormat: null,
          catalogValue: null,
          userValue: null,
        },
      }),
    );
  });

  it('lists only the current user tickets', async () => {
    prisma.ticket.findMany.mockResolvedValue([ticketRow()]);

    const result = await service.findAll(USER_ID, {});

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: USER_ID },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].authorId).toBe(USER_ID);
  });

  it('lets staff list tickets from every author', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.ticket.findMany.mockResolvedValue([ticketRow()]);

    await service.findAll(ADMIN_ID, {});

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('hides another user ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(
      ticketRow({ authorId: OTHER_ID, author: { id: OTHER_ID } }),
    );

    await expect(service.findById(USER_ID, TICKET_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets staff view any ticket', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.ticket.findUnique.mockResolvedValue(ticketRow());

    const result = await service.findById(ADMIN_ID, TICKET_ID);

    expect(result.id).toBe(TICKET_ID);
    expect(result.author).toEqual({ id: USER_ID });
  });

  it('lets staff move OPEN to IN_REVIEW and then to RESOLVED', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.ticket.findUnique.mockResolvedValue(ticketRow());
    prisma.ticket.update.mockResolvedValueOnce(
      ticketRow({
        status: 'IN_REVIEW',
        updatedAt: new Date('2026-09-30T01:00:00.000Z'),
      }),
    );

    const reviewed = await service.updateStatus(ADMIN_ID, TICKET_ID, {
      status: 'IN_REVIEW',
    });

    expect(reviewed.status).toBe('IN_REVIEW');
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'IN_REVIEW' },
      }),
    );

    prisma.ticket.findUnique.mockResolvedValue(
      ticketRow({ status: 'IN_REVIEW' }),
    );
    prisma.ticket.update.mockResolvedValueOnce(
      ticketRow({
        status: 'RESOLVED',
        resolutionNote: 'XP table updated',
        resolvedByUserId: ADMIN_ID,
      }),
    );

    const resolved = await service.updateStatus(ADMIN_ID, TICKET_ID, {
      status: 'RESOLVED',
      resolutionNote: ' XP table updated ',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionNote).toBe('XP table updated');
    expect(prisma.ticket.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          status: 'RESOLVED',
          resolutionNote: 'XP table updated',
          resolvedByUserId: ADMIN_ID,
          resolvedAt: expect.any(Date) as unknown as Date,
        },
      }),
    );
  });

  it('blocks a regular user from changing status', async () => {
    await expect(
      service.updateStatus(USER_ID, TICKET_ID, { status: 'IN_REVIEW' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid status transition', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.ticket.findUnique.mockResolvedValue(ticketRow());

    await expect(
      service.updateStatus(ADMIN_ID, TICKET_ID, {
        status: 'RESOLVED',
        resolutionNote: 'Skipped review',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await expect(service.findById(USER_ID, TICKET_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uploads evidence to the owner ticket and stores only a generated key', async () => {
    const file = jpeg();
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      authorId: USER_ID,
    });
    prisma.ticketEvidence.create.mockImplementation(
      (args: {
        data: {
          ticketId: string;
          storageKey: string;
          url: string | null;
          mimeType: string;
          source: string;
          byteSize: number;
        };
      }) =>
        Promise.resolve({
          id: EVIDENCE_ID,
          createdAt: new Date('2026-09-30T02:00:00.000Z'),
          ...args.data,
        }),
    );

    const result = await service.addEvidence(USER_ID, TICKET_ID, {
      file: { buffer: file, mimetype: 'image/jpeg' },
      source: 'CAMERA',
    });

    expect(result.storageKey).toMatch(
      new RegExp(
        `^tickets/${TICKET_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`,
      ),
    );
    expect(result.storageKey).not.toContain('screenshot');
    expect(result).toEqual({
      id: EVIDENCE_ID,
      ticketId: TICKET_ID,
      storageKey: result.storageKey,
      url: `https://cdn.example/${result.storageKey}`,
      mimeType: 'image/jpeg',
      source: 'CAMERA',
      byteSize: file.length,
      createdAt: new Date('2026-09-30T02:00:00.000Z'),
    });
    expect(prisma.ticketEvidence.create).toHaveBeenCalledWith({
      data: {
        ticketId: TICKET_ID,
        storageKey: result.storageKey,
        url: `https://cdn.example/${result.storageKey}`,
        mimeType: 'image/jpeg',
        source: 'CAMERA',
        byteSize: file.length,
      },
    });
    expect(storage.put).toHaveBeenCalledWith({
      storageKey: result.storageKey,
      body: file,
      mimeType: 'image/jpeg',
    });
  });

  it('rejects evidence on another user ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      authorId: OTHER_ID,
    });

    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: jpeg(), mimetype: 'image/jpeg' },
        source: 'DEVICE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects evidence for a missing ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: jpeg(), mimetype: 'image/jpeg' },
        source: 'CAMERA',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects evidence when the file is missing', async () => {
    await expect(
      service.addEvidence(USER_ID, TICKET_ID, { source: 'CAMERA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects an invalid image type', async () => {
    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: Buffer.from('not-an-image'), mimetype: 'image/jpeg' },
        source: 'CAMERA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an image larger than the configured limit', async () => {
    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: jpeg(MAX_BYTES + 1), mimetype: 'image/jpeg' },
        source: 'CAMERA',
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('reports storage failure without creating evidence', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      authorId: USER_ID,
    });
    storage.put.mockRejectedValue(new Error('disk full'));

    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: jpeg(), mimetype: 'image/jpeg' },
        source: 'DEVICE',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.ticketEvidence.create).not.toHaveBeenCalled();
  });

  it('removes the stored object when saving evidence fails', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      authorId: USER_ID,
    });
    prisma.ticketEvidence.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: jpeg(), mimetype: 'image/jpeg' },
        source: 'CAMERA',
      }),
    ).rejects.toThrow('db down');
    expect(storage.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^tickets\//),
    );
  });

  it('reports unconfigured storage without creating evidence', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      authorId: USER_ID,
    });
    storage.put.mockRejectedValue(new TicketStorageNotConfiguredError());

    await expect(
      service.addEvidence(USER_ID, TICKET_ID, {
        file: { buffer: jpeg(), mimetype: 'image/jpeg' },
        source: 'CAMERA',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.ticketEvidence.create).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('lets an admin read evidence and blocks attaching it to another user', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.ticketEvidence.findFirst.mockResolvedValue({
      mimeType: 'image/jpeg',
      storageKey: `tickets/${TICKET_ID}/${EVIDENCE_ID}.jpg`,
      ticket: { authorId: USER_ID },
    });

    const evidence = await service.readEvidence(
      ADMIN_ID,
      TICKET_ID,
      EVIDENCE_ID,
    );
    expect(evidence.mimeType).toBe('image/jpeg');
    expect(evidence.filename).toBe('evidence.jpg');
    expect(evidence.body[0]).toBe(0xff);

    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      authorId: USER_ID,
    });
    await expect(
      service.addEvidence(ADMIN_ID, TICKET_ID, {
        file: { buffer: jpeg(), mimetype: 'image/jpeg' },
        source: 'CAMERA',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
