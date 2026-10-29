import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

const CHARACTER_SELECT = {
  id: true,
  name: true,
  vocation: true,
  level: true,
  world: true,
} as const;

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCharacterDto) {
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.create({
        data: {
          userId,
          name: dto.name.trim(),
          vocation: dto.vocation.trim(),
          level: dto.level,
          world: dto.world.trim(),
        },
        select: CHARACTER_SELECT,
      });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { activeCharacterId: true },
      });
      if (!user?.activeCharacterId) {
        await tx.user.update({
          where: { id: userId },
          data: { activeCharacterId: character.id },
        });
      }
      return character;
    });
  }

  findAll(userId: string) {
    return this.prisma.character.findMany({
      where: { userId },
      select: CHARACTER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    return this.findOwnedOrFail(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateCharacterDto) {
    await this.findOwnedOrFail(userId, id);

    return this.prisma.character.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.vocation !== undefined
          ? { vocation: dto.vocation.trim() }
          : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.world !== undefined ? { world: dto.world.trim() } : {}),
      },
      select: CHARACTER_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedOrFail(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { activeCharacterId: true },
      });
      await tx.character.delete({ where: { id } });
      if (user?.activeCharacterId !== id) return;
      const next = await tx.character.findFirst({
        where: { userId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      await tx.user.update({
        where: { id: userId },
        data: { activeCharacterId: next?.id ?? null },
      });
    });
  }

  async getActive(userId: string) {
    const character = await this.ensureActive(userId);
    if (!character) {
      throw new NotFoundException('No active character');
    }
    return character;
  }

  async setActive(userId: string, id: string) {
    const character = await this.findOwnedOrFail(userId, id);

    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCharacterId: character.id },
    });

    return character;
  }

  /// One persistent selection per account. It is both the principal character
  /// and the active character used by Hunts and Bestiary.
  private async ensureActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeCharacterId: true },
    });
    if (user?.activeCharacterId) {
      const current = await this.prisma.character.findFirst({
        where: { id: user.activeCharacterId, userId },
        select: CHARACTER_SELECT,
      });
      if (current) return current;
    }
    const first = await this.prisma.character.findFirst({
      where: { userId },
      select: CHARACTER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    if (!first) return null;
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCharacterId: first.id },
    });
    return first;
  }

  private async findOwnedOrFail(userId: string, id: string) {
    const character = await this.prisma.character.findFirst({
      where: { id, userId },
      select: CHARACTER_SELECT,
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    return character;
  }
}
