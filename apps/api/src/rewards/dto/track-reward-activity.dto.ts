import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CLIENT_TRACKABLE_EVENTS, REWARD_EVENTS } from '../rewards.constants';

const TRACKABLE = [...CLIENT_TRACKABLE_EVENTS] as string[];

export class TrackRewardActivityDto {
  @IsString()
  @IsIn(TRACKABLE)
  eventType!: (typeof REWARD_EVENTS)[keyof typeof REWARD_EVENTS];

  @IsString()
  @MinLength(1)
  @MaxLength(190)
  referenceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceType?: string;
}