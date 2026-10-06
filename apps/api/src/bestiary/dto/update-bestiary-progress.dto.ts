import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateBestiaryProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  kills: number;
}
