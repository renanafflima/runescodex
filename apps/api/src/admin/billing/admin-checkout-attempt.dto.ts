import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ReconcileCheckoutAttemptDto {
  @IsIn(['READY', 'FAILED'])
  outcome!: 'READY' | 'FAILED';

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
