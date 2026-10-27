import { Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeviceProofDto } from './device-proof.dto';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;

  @ValidateNested()
  @Type(() => DeviceProofDto)
  device!: DeviceProofDto;
}
