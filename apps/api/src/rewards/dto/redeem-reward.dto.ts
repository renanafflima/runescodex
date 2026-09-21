import { IsUUID } from 'class-validator';

export class RedeemRewardDto {
  @IsUUID()
  catalogItemId: string;
}
