import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CharactersService } from './characters.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CharactersService', () => {
  let service: CharactersService;
  const prisma = {
    character: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharactersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CharactersService);
  });

  it('creates a character using only the authenticated userId', async () => {
    const created = {
      id: 'char-1',
      name: 'Knight',
      vocation: 'EK',
      level: 1200,
      world: 'World',
    };
    prisma.character.create.mockResolvedValue(created);

    const result = await service.create('user-a', {
      name: '  Knight ',
      vocation: ' EK ',
      level: 1200,
      world: ' World ',
    });

    expect(prisma.character.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-a',
        name: 'Knight',
        vocation: 'EK',
        level: 1200,
        world: 'World',
      },
      select: {
        id: true,
        name: true,
        vocation: true,
        level: true,
        world: true,
      },
    });
    expect(result).toEqual(created);
    expect(JSON.stringify(result)).not.toContain('userId');
  });

  it('lists only characters for the authenticated user', async () => {
    prisma.character.findMany.mockResolvedValue([]);

    await service.findAll('user-a');

    expect(prisma.character.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
      select: {
        id: true,
        name: true,
        vocation: true,
        level: true,
        world: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('rejects access to another user character with the same not-found error', async () => {
    prisma.character.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user-a', 'char-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.character.findFirst).toHaveBeenCalledWith({
      where: { id: 'char-b', userId: 'user-a' },
      select: {
        id: true,
        name: true,
        vocation: true,
        level: true,
        world: true,
      },
    });
  });

  it('does not update a character that belongs to another user', async () => {
    prisma.character.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-a', 'char-b', { level: 900 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.character.update).not.toHaveBeenCalled();
  });

  it('does not delete a character that belongs to another user', async () => {
    prisma.character.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-a', 'char-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.character.delete).not.toHaveBeenCalled();
  });

  it('returns no active character when none is selected', async () => {
    prisma.user.findUnique.mockResolvedValue({ activeCharacterId: null });

    await expect(service.getActive('user-a')).rejects.toMatchObject({
      message: 'No active character',
    });
  });

  it('activates an owned character and does not activate another user character', async () => {
    const owned = {
      id: 'char-1',
      name: 'Knight',
      vocation: 'EK',
      level: 1200,
      world: 'World',
    };
    prisma.character.findFirst.mockResolvedValueOnce(owned);
    prisma.user.update.mockResolvedValue({ id: 'user-a', activeCharacterId: 'char-1' });

    await expect(service.setActive('user-a', 'char-1')).resolves.toEqual(owned);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-a' },
      data: { activeCharacterId: 'char-1' },
    });

    prisma.character.findFirst.mockResolvedValueOnce(null);
    await expect(service.setActive('user-a', 'char-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('returns the active character after a switch', async () => {
    prisma.user.findUnique.mockResolvedValue({ activeCharacterId: 'char-2' });
    prisma.character.findFirst.mockResolvedValue({
      id: 'char-2',
      name: 'Paladin',
      vocation: 'RP',
      level: 850,
      world: 'World',
    });

    await expect(service.getActive('user-a')).resolves.toEqual({
      id: 'char-2',
      name: 'Paladin',
      vocation: 'RP',
      level: 850,
      world: 'World',
    });
    expect(prisma.character.findFirst).toHaveBeenCalledWith({
      where: { id: 'char-2', userId: 'user-a' },
      select: {
        id: true,
        name: true,
        vocation: true,
        level: true,
        world: true,
      },
    });
  });
});
