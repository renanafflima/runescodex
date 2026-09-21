import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelRedemptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
