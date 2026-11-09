import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { PARTY_LIMITS } from '../party.constants';

function trimOptional(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CreatePartyDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(PARTY_LIMITS.nameMin)
  @MaxLength(PARTY_LIMITS.nameMax)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PARTY_LIMITS.descriptionMax)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class UpdatePartyDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(PARTY_LIMITS.nameMin)
  @MaxLength(PARTY_LIMITS.nameMax)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PARTY_LIMITS.descriptionMax)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class InvitePartyMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
}

export class TransferPartyLeaderDto {
  @IsUUID()
  userId!: string;
}

export class CreateHuntSessionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(PARTY_LIMITS.sessionTitleMax)
  title!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PARTY_LIMITS.sessionDescriptionMax)
  description?: string;

  @IsOptional()
  @IsUUID()
  rotationId?: string;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  participantIds?: string[];
}

export class AddSessionParticipantDto {
  @IsUUID()
  userId!: string;
}

export class ListPartyQueryDto extends PageQueryDto {}

export class ListSharedActivitiesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
