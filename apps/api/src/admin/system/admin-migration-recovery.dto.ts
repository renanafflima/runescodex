import { IsIn } from 'class-validator';
import {
  MIGRATION_RECOVERY_ALLOWLIST,
  type MigrationRecoveryStepName,
} from './admin-migration-recovery.constants';

export class ExecuteMigrationRecoveryStepDto {
  @IsIn([...MIGRATION_RECOVERY_ALLOWLIST])
  step!: MigrationRecoveryStepName;
}
