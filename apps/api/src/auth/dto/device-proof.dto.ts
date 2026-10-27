import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'] as const;

export class DeviceProofDto {
  @IsUUID()
  installationId!: string;

  @IsUUID()
  challengeId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  signature!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsIn(DEVICE_TYPES)
  deviceType?: (typeof DEVICE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  osName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientName?: string;
}

export class DeviceChallengeDto {
  @IsUUID()
  installationId!: string;

  @IsString()
  @MinLength(32)
  @MaxLength(512)
  publicKeySpki!: string;
}

export class RemoveDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsUUID()
  challengeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  signature?: string;
}
