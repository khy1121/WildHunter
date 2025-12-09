
export type Vector2 = { x: number; y: number };

export enum CharacterType {
  WARRIOR = 'WARRIOR',
  MAGE = 'MAGE',
  RANGER = 'RANGER',
}

export interface CharacterDef {
  id: CharacterType;
  name: string;
  description: string;
  stats: BaseStats;
  startingWeapon: WeaponId;
  color: string;
  skinType: 'KNIGHT' | 'WIZARD' | 'ROGUE'; // For rendering style
}

export interface BaseStats {
  maxHp: number;
  moveSpeed: number;
  might: number; // Damage multiplier
  area: number; // Area size multiplier
  cooldown: number; // Cooldown reduction (0.9 = 10% faster)
  amount: number; // Extra projectiles
  magnet: number; // Pickup range
  luck?: number;
  revival?: number;
}

export enum WeaponId {
  WHIP = 'WHIP',
  MAGIC_WAND = 'MAGIC_WAND',
  AXE = 'AXE',
  KNIFE = 'KNIFE',
  GARLIC = 'GARLIC',
  HOLY_WATER = 'HOLY_WATER',
  // Evolutions
  BLOODY_TEAR = 'BLOODY_TEAR',
  HOLY_WAND = 'HOLY_WAND',
  DEATH_SPIRAL = 'DEATH_SPIRAL',
  THOUSAND_EDGE = 'THOUSAND_EDGE',
}

export enum PassiveId {
  SPINACH = 'SPINACH', // Might
  EMPTY_TOME = 'EMPTY_TOME', // Cooldown
  CANDELABRADOR = 'CANDELABRADOR', // Area
  BRACER = 'BRACER', // Speed
  SPELLBINDER = 'SPELLBINDER', // Duration
  HOLLOW_HEART = 'HOLLOW_HEART', // MaxHP
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  description: string;
  type: '근접' | '투사체' | '범위' | '장판';
  damage: number;
  area: number;
  speed: number;
  duration: number;
  cooldown: number; // in milliseconds
  amount: number;
  knockback: number;
  pierce: number; // -1 for infinite
  evolvesTo?: WeaponId;
  requiresPassive?: PassiveId;
  color: string;
  // Visuals
  icon?: string;
  visualType?: 'SLASH' | 'PROJECTILE' | 'SPIN' | 'AURA' | 'ZONE';
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  description: string;
  statModifier: Partial<BaseStats>; 
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  xpValue: number;
  color: string;
  radius: number;
  spriteType: 'BAT' | 'SKELETON' | 'GHOST' | 'BOSS';
}

// Maps
export enum MapId {
  GARDEN = 'GARDEN',
  OCEAN = 'OCEAN',
  PALACE = 'PALACE',
}

export interface MapDef {
  id: MapId;
  name: string;
  description: string;
  difficultyMultiplier: number; // 1.0 = normal
  themeColors: {
    backgroundA: string; // Checker tile 1
    backgroundB: string; // Checker tile 2
    detail: string;      // Decorative elements
  };
}

// Shop & Persistence
export enum UpgradeId {
  MIGHT = 'MIGHT',
  ARMOR = 'ARMOR', // MaxHP actually
  RECOVERY = 'RECOVERY',
  GREED = 'GREED',
}

export interface GlobalUpgrade {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  costScaling: number;
  maxLevel: number;
  statModifier: Partial<BaseStats>;
}

export interface UserSaveData {
  coins: number;
  upgrades: Record<string, number>; // UpgradeId -> Level
}

// Runtime Types
export interface GameState {
  level: number;
  xp: number;
  xpToNextLevel: number;
  time: number;
  killCount: number; // Used as coins in session
  totalCoins: number; // Persistent coins
  isPaused: boolean;
  isGameOver: boolean;
  hp: number;
  maxHp: number;
  weapons: Record<string, number>; // WeaponId -> Level
  passives: Record<string, number>; // PassiveId -> Level
}
