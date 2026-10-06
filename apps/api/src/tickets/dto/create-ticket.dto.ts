import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  TicketEvidenceSource,
  TicketImpact,
  TicketOrigin,
  TicketPartyFormat,
  TicketProblemType,
  TicketVocation,
} from '../../../generated/prisma/client.js';
import { MAX_TICKET_EVIDENCES } from '../tickets.constants';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class CreateTicketEvidenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^(?!data:)[^\s]+$/, {
    message: 'storageKey must be a storage reference',
  })
  storageKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsIn(IMAGE_MIME_TYPES)
  mimeType: (typeof IMAGE_MIME_TYPES)[number];

  @IsEnum(TicketEvidenceSource)
  source: TicketEvidenceSource;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20_000_000)
  byteSize?: number;
}

export class CreateTicketDto {
  @IsEnum(TicketProblemType)
  problemType: TicketProblemType;

  @IsEnum(TicketImpact)
  impact: TicketImpact;

  @IsEnum(TicketOrigin)
  origin: TicketOrigin;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsUUID()
  huntId?: string;

  @IsOptional()
  @IsUUID()
  creatureId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  playerLevel?: number;

  @IsOptional()
  @IsEnum(TicketPartyFormat)
  partyFormat?: TicketPartyFormat;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsEnum(TicketVocation, { each: true })
  vocations?: TicketVocation[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  catalogValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userValue?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TICKET_EVIDENCES)
  @ValidateNested({ each: true })
  @Type(() => CreateTicketEvidenceDto)
  evidences?: CreateTicketEvidenceDto[];
}
