/** Combat stats used by the siumai 傷害 formula. */
export type CombatStats = {
  attack: number;
  defenseBreak: number;
  critRate: number;
  critDamage: number;
  elementalPower: number;
  skillDamage: number;
  resonance: number;
  damageBoost: number;
  circuitBoost: number;
  allElementDamage: number;
  additionalDamage: number;
  statusDamage: number;
  bossDamage: number;
  penetration: number;
  trainingCorrection: number;
  skillMultiplier: number;
  /** Extra flat attack from % multipliers after stacking. */
  attackPercent?: number;
  normalAttackDamage?: number;
};

/** Gear / item stat bag — only fields present contribute. */
export type StatBag = Partial<
  CombatStats & {
    critRateMagic: number;
    penetrationMagic: number;
    attackPercentMagic: number;
    intPercent: number;
    strPercent: number;
    resonanceCharge: number;
    attackSpeed: number;
    cooldownSpeed: number;
  }
>;

export type Equipment = {
  id: string;
  name: string;
  set?: string;
  slot: string;
  stats: StatBag;
  statLines: string[];
  effects: string[];
  source?: string;
  demo?: boolean;
};

export type CatalogItem = {
  id: string;
  name: string;
  kind: "item";
  stats: StatBag;
  statLines: string[];
  demo?: boolean;
};

export type DamageType = "magic" | "physical";

/** Skill element used to decide which circuit 冰/火/電/暗 屬強 apply. */
export type CircuitElement = "ice" | "fire" | "electric" | "dark";

export type CircuitKind = "time" | "nether" | "star" | "key";

export type CircuitSlotId =
  | "頭"
  | "手"
  | "腳"
  | "上衣"
  | "褲子"
  | "印章"
  | "護符"
  | "武器"
  | "項鍊"
  | "護腕"
  | "戒指";

export type CircuitStatKey =
  | "str"
  | "int"
  | "vit"
  | "agi"
  | "spr"
  | "hp"
  | "pAtk"
  | "mAtk"
  | "pDef"
  | "mDef"
  | "critRate"
  | "critDamage"
  | "atkSpeed"
  | "cooldown"
  | "ice"
  | "fire"
  | "electric"
  | "dark"
  | "skillDamage"
  | "attack"
  | "circuitBoost"
  | "allElementDamage"
  | "elementalPower"
  | "damageBoost"
  | "bossDamage"
  | "statusDamage"
  | "strInt"
  | "agiSpr";

export type CircuitAffix = {
  stat: CircuitStatKey;
  /** Percent stats stored as 0–1 fractions; flat stats as raw numbers. */
  value: number;
};

export type CircuitPiece = {
  id: string;
  name: string;
  kind: CircuitKind;
  main: CircuitAffix;
  /** Up to 4 shared sub-stats. */
  subs: CircuitAffix[];
  /** Up to 4 breakthrough stats (迴路 30 等後解鎖的突破屬性). */
  breakthroughs?: CircuitAffix[];
  createdAt: string;
  updatedAt: string;
};

/** A 11-slot circuit loadout. Profiles pick one as the active scheme. */
export type CircuitScheme = {
  id: string;
  name: string;
  note: string;
  equipped: Partial<Record<CircuitSlotId, string | null>>;
  createdAt: string;
  updatedAt: string;
};

export type Profile = {
  id: string;
  name: string;
  note: string;
  damageType: DamageType;
  /** Which 冰/火/電/暗 circuit stats count as 屬強. `"all"` sums every element. */
  element?: CircuitElement | "all";
  /** Base stats before selected gear/items. */
  base: CombatStats;
  /** slot -> equipment id */
  equipped: Record<string, string | null>;
  /** selected item ids */
  itemIds: string[];
  /** Active circuit scheme id. */
  circuitSchemeId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DamageResult = {
  finalDamage: number;
  factors: {
    atkBreak: number;
    critFactor: number;
    elemental: number;
    skillResonance: number;
    damageBoost: number;
    circuit: number;
    allElement: number;
    additional: number;
    statusBoss: number;
    training: number;
    skillMultiplier: number;
  };
  effectiveStats: CombatStats;
  vsMonster: (monsterDef: number) => number;
};

export type AppStore = {
  profiles: Profile[];
  equipment: Equipment[];
  items: CatalogItem[];
  compareIds: string[];
  activeProfileId: string | null;
};
