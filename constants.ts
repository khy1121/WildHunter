
import { CharacterDef, CharacterType, EnemyDef, PassiveDef, PassiveId, WeaponDef, WeaponId, GlobalUpgrade, UpgradeId, MapDef, MapId } from "./types";

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;

export const CHARACTERS: Record<CharacterType, CharacterDef> = {
  [CharacterType.WARRIOR]: {
    id: CharacterType.WARRIOR,
    name: '안토니오 (기사)',
    description: '기본 체력이 높고 대검을 휘둘러 주변 적을 공격합니다.',
    stats: { maxHp: 150, moveSpeed: 2.2, might: 1.2, area: 1.2, cooldown: 1, amount: 0, magnet: 50 },
    startingWeapon: WeaponId.WHIP,
    color: '#3b82f6',
    skinType: 'KNIGHT'
  },
  [CharacterType.MAGE]: {
    id: CharacterType.MAGE,
    name: '이멜다 (마법사)',
    description: '마법 탄환을 사용하며 경험치 획득량이 많습니다.',
    stats: { maxHp: 90, moveSpeed: 2.6, might: 1.0, area: 1.1, cooldown: 0.9, amount: 0, magnet: 80 },
    startingWeapon: WeaponId.MAGIC_WAND,
    color: '#a855f7',
    skinType: 'WIZARD'
  },
  [CharacterType.RANGER]: {
    id: CharacterType.RANGER,
    name: '젠나로 (도적)',
    description: '수리검을 투척하며 투사체 개수가 1개 더 많습니다.',
    stats: { maxHp: 100, moveSpeed: 3.2, might: 1.0, area: 1, cooldown: 1, amount: 1, magnet: 60 },
    startingWeapon: WeaponId.KNIFE,
    color: '#22c55e',
    skinType: 'ROGUE'
  },
};

export const MAPS: Record<MapId, MapDef> = {
  [MapId.GARDEN]: {
    id: MapId.GARDEN,
    name: '광기의 정원',
    description: '적당한 난이도의 푸른 숲입니다. 초보자에게 추천합니다.',
    difficultyMultiplier: 1.0,
    themeColors: {
      backgroundA: '#14532d', // Dark green
      backgroundB: '#166534', // Slightly lighter green
      detail: '#22c55e',      // Bright green grass/flowers
    }
  },
  [MapId.OCEAN]: {
    id: MapId.OCEAN,
    name: '심해의 사원',
    description: '적들의 움직임이 빠르고 물량이 많습니다.',
    difficultyMultiplier: 1.3,
    themeColors: {
      backgroundA: '#0f172a', // Dark blue (Slate 900)
      backgroundB: '#1e293b', // Slate 800
      detail: '#38bdf8',      // Light Blue bubbles/waves
    }
  },
  [MapId.PALACE]: {
    id: MapId.PALACE,
    name: '황금 궁전',
    description: '강력한 적들이 등장하는 화려한 궁전입니다.',
    difficultyMultiplier: 1.6,
    themeColors: {
      backgroundA: '#3f2e3e', // Dark Purple/Brown
      backgroundB: '#4a3b4a', // Lighter
      detail: '#fbbf24',      // Gold accents
    }
  }
};

// Augmented WeaponDef to include visual hints
interface VisualWeaponDef extends WeaponDef {
  visualType?: 'SLASH' | 'PROJECTILE' | 'SPIN' | 'AURA' | 'ZONE';
  visualAsset?: string;
}

export const EVOLUTION_WEAPON_IDS = [
  WeaponId.BLOODY_TEAR,
  WeaponId.HOLY_WAND,
  WeaponId.DEATH_SPIRAL,
  WeaponId.THOUSAND_EDGE
];

export const WEAPONS: Record<WeaponId, VisualWeaponDef> = {
  [WeaponId.WHIP]: {
    id: WeaponId.WHIP,
    name: '기사의 대검',
    description: '전방을 넓게 베어 치명적인 피해를 입힙니다.',
    type: '근접',
    damage: 25,
    area: 120, // Increased for better visual
    speed: 0,
    duration: 300, // Quick slash
    cooldown: 1200,
    amount: 1,
    knockback: 15,
    pierce: -1,
    color: '#f43f5e', // Vibrant Pink-Red
    evolvesTo: WeaponId.BLOODY_TEAR,
    requiresPassive: PassiveId.HOLLOW_HEART,
    visualType: 'SLASH'
  },
  [WeaponId.BLOODY_TEAR]: {
    id: WeaponId.BLOODY_TEAR,
    name: '피의 대검 (진화)',
    description: '적의 생명력을 흡수하는 붉은 참격을 날립니다.',
    type: '근접',
    damage: 50,
    area: 160,
    speed: 0,
    duration: 350,
    cooldown: 1000,
    amount: 1,
    knockback: 25,
    pierce: -1,
    color: '#be123c', // Deep Crimson
    visualType: 'SLASH'
  },
  [WeaponId.MAGIC_WAND]: {
    id: WeaponId.MAGIC_WAND,
    name: '마법 지팡이',
    description: '가장 가까운 적에게 마법 구체를 발사합니다.',
    type: '투사체',
    damage: 15,
    area: 10,
    speed: 6,
    duration: 1500,
    cooldown: 1000,
    amount: 1,
    knockback: 8,
    pierce: 1,
    color: '#60a5fa',
    evolvesTo: WeaponId.HOLY_WAND,
    requiresPassive: PassiveId.EMPTY_TOME,
    visualType: 'PROJECTILE'
  },
  [WeaponId.HOLY_WAND]: {
    id: WeaponId.HOLY_WAND,
    name: '신성한 지팡이 (진화)',
    description: '기관총처럼 마법 구체를 쏟아냅니다.',
    type: '투사체',
    damage: 25,
    area: 12,
    speed: 9,
    duration: 1500,
    cooldown: 150,
    amount: 1,
    knockback: 10,
    pierce: 1,
    color: '#1d4ed8',
    visualType: 'PROJECTILE'
  },
  [WeaponId.AXE]: {
    id: WeaponId.AXE,
    name: '던지기 도끼',
    description: '포물선을 그리며 떨어지는 도끼를 던집니다.',
    type: '장판',
    damage: 35,
    area: 25,
    speed: 6,
    duration: 1200,
    cooldown: 1400,
    amount: 1,
    knockback: 15,
    pierce: -1,
    color: '#eab308',
    evolvesTo: WeaponId.DEATH_SPIRAL,
    requiresPassive: PassiveId.CANDELABRADOR,
    visualType: 'SPIN'
  },
  [WeaponId.DEATH_SPIRAL]: {
    id: WeaponId.DEATH_SPIRAL,
    name: '죽음의 나선 (진화)',
    description: '사방으로 퍼져나가는 거대한 낫을 던집니다.',
    type: '범위',
    damage: 60,
    area: 40,
    speed: 8,
    duration: 3000,
    cooldown: 1300,
    amount: 1,
    knockback: 12,
    pierce: -1,
    color: '#a16207',
    visualType: 'SPIN'
  },
  [WeaponId.KNIFE]: {
    id: WeaponId.KNIFE,
    name: '수리검',
    description: '빠르게 회전하며 날아가는 수리검을 던집니다.',
    type: '투사체',
    damage: 12,
    area: 12,
    speed: 10,
    duration: 1000,
    cooldown: 350,
    amount: 1,
    knockback: 3,
    pierce: 1,
    color: '#cbd5e1',
    evolvesTo: WeaponId.THOUSAND_EDGE,
    requiresPassive: PassiveId.BRACER,
    visualType: 'SPIN'
  },
  [WeaponId.THOUSAND_EDGE]: {
    id: WeaponId.THOUSAND_EDGE,
    name: '무한의 검 (진화)',
    description: '전방으로 끊임없이 단검을 투척합니다.',
    type: '투사체',
    damage: 20,
    area: 15,
    speed: 16,
    duration: 1200,
    cooldown: 60,
    amount: 1,
    knockback: 5,
    pierce: 3,
    color: '#475569',
    visualType: 'PROJECTILE'
  },
  [WeaponId.GARLIC]: {
    id: WeaponId.GARLIC,
    name: '마늘 오라',
    description: '자신 주변에 적에게 피해를 주는 오라를 생성합니다.',
    type: '범위',
    damage: 8,
    area: 60,
    speed: 0,
    duration: 100, 
    cooldown: 400,
    amount: 1,
    knockback: 4,
    pierce: -1,
    color: '#fb7185',
    visualType: 'AURA'
  },
  [WeaponId.HOLY_WATER]: {
    id: WeaponId.HOLY_WATER,
    name: '성수',
    description: '하늘에서 성수가 떨어져 불타는 장판을 생성합니다.',
    type: '장판',
    damage: 20,
    area: 50,
    speed: 3,
    duration: 2500,
    cooldown: 2500,
    amount: 1,
    knockback: 0,
    pierce: -1,
    color: '#38bdf8',
    visualType: 'ZONE'
  },
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  [PassiveId.SPINACH]: { id: PassiveId.SPINACH, name: '시금치', description: '공격력이 10% 증가합니다.', statModifier: { might: 0.1 } },
  [PassiveId.EMPTY_TOME]: { id: PassiveId.EMPTY_TOME, name: '빈 책', description: '무기 쿨타임이 8% 감소합니다.', statModifier: { cooldown: 0.08 } },
  [PassiveId.CANDELABRADOR]: { id: PassiveId.CANDELABRADOR, name: '촛대', description: '공격 범위가 10% 증가합니다.', statModifier: { area: 0.1 } },
  [PassiveId.BRACER]: { id: PassiveId.BRACER, name: '팔 보호대', description: '투사체 속도가 10% 증가합니다.', statModifier: {} },
  [PassiveId.SPELLBINDER]: { id: PassiveId.SPELLBINDER, name: '주문속박기', description: '무기 지속시간이 10% 증가합니다.', statModifier: {} },
  [PassiveId.HOLLOW_HEART]: { id: PassiveId.HOLLOW_HEART, name: '검은 심장', description: '최대 체력이 20% 증가합니다.', statModifier: { maxHp: 20 } },
};
