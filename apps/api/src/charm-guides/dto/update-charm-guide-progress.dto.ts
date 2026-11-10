import { IsBoolean, IsUUID } from 'class-validator';

export class UpdateCharmGuideProgressDto {
  @IsUUID()
  characterId: string;

  @IsUUID()
  creatureId: string;

  @IsBoolean()
  completed: boolean;
}
