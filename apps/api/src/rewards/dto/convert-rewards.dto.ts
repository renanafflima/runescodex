import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';

export enum RewardConversionKind {
  POINTS_TO_GOLD = 'POINTS_TO_GOLD',
  GOLD_TO_DIAMOND = 'GOLD_TO_DIAMOND',
}

export class ConvertRewardsDto {
  @IsEnum(RewardConversionKind)
  conversion: RewardConversionKind;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}
