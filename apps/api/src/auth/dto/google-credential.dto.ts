import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeviceProofDto } from './device-proof.dto';

export class GoogleCredentialDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential: string;

  @ValidateNested()
  @Type(() => DeviceProofDto)
  device!: DeviceProofDto;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{6,16}$/)
  referralCode?: string;
}
