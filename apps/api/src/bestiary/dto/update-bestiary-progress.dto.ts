import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateBestiaryProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  kills: number;
}
