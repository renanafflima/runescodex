import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRedemptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
