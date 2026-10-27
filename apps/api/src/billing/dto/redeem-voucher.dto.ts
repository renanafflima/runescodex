import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemVoucherDto {
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  code!: string;
}
