export type AuthUser = {
  id: string;
  email: string;
  role?: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export type Character = {
  id: string;
  name: string;
  vocation: string;
  level: number;
  world: string;
};

export type HuntVocation = {
  vocation: string | null;
  isRecommended: boolean;
  levelMin: number | null;
  levelMax: number | null;
  xpPerHour: number | null;
  profitPerHour: number | null;
  difficulty: string | null;
  notes: string | null;
};

export type HuntCreature = {
  id: string | null;
  slug: string | null;
  name: string;
  image: string | null;
  hp: number | null;
  xp: number | null;
  elements: string[];
  recommendedCharm: string | null;
  damageType: string | null;
  isPrimary: boolean;
  quantity: number | null;
  notes: string | null;
};

export type HuntVideo = {
  id: string;
  title: string | null;
  url: string;
  channel: string | null;
  isRecommended: boolean;
};

export type HuntLoot = {
  id: string;
  itemName: string;
  image: string | null;
  estimatedValue: number | null;
  importance: string | null;
};

export type HuntListItem = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  subLocation: string | null;
  displayLocation: string;
  difficulty: string | null;
  respawn: string | null;
  vocations: HuntVocation[];
  creature: string;
  creatureImage: string | null;
  xpH: number | null;
  profitH: number | null;
  levelMin: number | null;
  levelMax: number | null;
  vocation: string | null;
  spawn: HuntCreature[];
  mapImage: string | null;
  youtubeUrl: string | null;
};

export type HuntDetail = HuntListItem & {
  description: string | null;
  heroImage: string | null;
  videos: HuntVideo[];
  loot: HuntLoot[];
};

export type BestiaryProgress = {
  kills: number;
  completed: boolean;
  completedAt: string | null;
  progressPercentage: number;
};

export type BestiaryEntry = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  hp: number | null;
  experience: number | null;
  difficulty: string;
  location: string;
  region: string;
  killsRequired: number | null;
  killsPerHour: number | null;
  estimatedHours: number | null;
  youtubeUrl: string | null;
  killTogether: string[];
  weaknesses: string[];
  description: string | null;
  progress: BestiaryProgress | null;
};
