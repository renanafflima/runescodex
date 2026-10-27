import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeviceProofDto } from './device-proof.dto';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ValidateNested()
  @Type(() => DeviceProofDto)
  device!: DeviceProofDto;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{6,16}$/)
  referralCode?: string;
}
