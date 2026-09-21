import { IsIn } from 'class-validator';
import { MISSION_PERIODS, type MissionPeriod } from '../rewards.constants';

export class ListMissionsQueryDto {
  @IsIn(MISSION_PERIODS)
  period: MissionPeriod;
}
