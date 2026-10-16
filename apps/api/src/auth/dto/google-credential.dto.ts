import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleCredentialDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential: string;
}
