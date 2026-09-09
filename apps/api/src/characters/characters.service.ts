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

  create(userId: string, dto: CreateCharacterDto) {
    return this.prisma.character.create({
      data: {
        userId,
        name: dto.name.trim(),
        vocation: dto.vocation.trim(),
        level: dto.level,
        world: dto.world.trim(),
      },
      select: CHARACTER_SELECT,
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
        ...(dto.vocation !== undefined ? { vocation: dto.vocation.trim() } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.world !== undefined ? { world: dto.world.trim() } : {}),
      },
      select: CHARACTER_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedOrFail(userId, id);
    await this.prisma.character.delete({ where: { id } });
  }

  async getActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeCharacterId: true },
    });

    if (!user?.activeCharacterId) {
      throw new NotFoundException('No active character');
    }

    const character = await this.prisma.character.findFirst({
      where: { id: user.activeCharacterId, userId },
      select: CHARACTER_SELECT,
    });

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
