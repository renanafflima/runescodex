import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeliverRedemptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNote?: string;
}
