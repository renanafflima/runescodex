import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  vocation: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  level: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  world: string;
}
