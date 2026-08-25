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
  /**
   * Combined attack% after stacking (力量/智力 + 裝備攻擊%).
   * Applied once at resolve: (攻擊力 + 對應物攻/魔攻) × (1 + attackPercent).
   */
  attackPercent?: number;
  /** Flat 物攻 from attributes (not percent). */
  physicalAttack?: number;
  /** Flat 魔攻 from attributes (not percent). */
  magicAttack?: number;
  normalAttackDamage?: number;
};

/** Gear / item stat bag — only fields present contribute. */
export type StatBag = Partial<
  CombatStats & {
    critRateMagic: number;
    penetrationMagic: number;
    attackPercentMagic: number;
    /** Flat 物攻 (circuit / 物攻屬性). */
    physicalAttack: number;
    /** Flat 魔攻 (circuit / 魔攻屬性). */
    magicAttack: number;
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

/** Built-in advanced class ids. Custom jobs use other string ids. */
export type BuiltinProfessionId =
  | "berserker"
  | "mageblade"
  | "ghostblade"
  | "bounty"
  | "artillerist"
  | "elementalist"
  | "warlock"
  | "magician"
  | "scythe"
  | "puppeteer"
  | "cloudheart"
  | "heartbreaker"
  | "espionage"
  | "sonic"
  | "elsa";

/** Advanced class used to pick 物/魔、屬性與循環倍率. */
export type ProfessionId = string;

export type ProfessionFamily =
  | "sword"
  | "gunner"
  | "mage"
  | "puppet"
  | "fighter"
  | "side";

/** One bar in a training-ground rotation. `percent` is the in-game 850 = 850%. */
export type ProfessionSkill = {
  id: string;
  name: string;
  percent: number;
  hits: number;
  uses: number;
  enabled: boolean;
};

export type ProfessionDef = {
  id: ProfessionId;
  name: string;
  family: ProfessionFamily;
  damageType: DamageType;
  defaultElement: CircuitElement | "all";
  /** Fallback when the skill table sums to 0. 1 = same as no profession. */
  cycleMultiplier: number;
  /** Rotation length in seconds; used for 訓練場 DPS. */
  cycleSeconds: number;
  skills: ProfessionSkill[];
  passives: StatBag;
  note: string;
};

/** Local edits on top of the built-in catalog (shared by every profile). */
export type ProfessionOverride = {
  id: ProfessionId;
  cycleMultiplier?: number;
  cycleSeconds?: number;
  skills?: ProfessionSkill[];
  note?: string;
};

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
  /** Up to 4 breakthrough stats (迴路 30 等後解鎖；同一屬性可重複，數值加總). */
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

/** 史詩（金）/ 稀有（粉）— 計算用的兩檔主要稀有度。 */
export type InsigniaRarity = "epic" | "rare";

/** Same 11 equipment slots as circuits. */
export type InsigniaSlotId = CircuitSlotId;

export type InsigniaRank = 1 | 2 | 3;

export type InsigniaStatKey =
  | "critRate"
  | "critDamage"
  | "skillDamage"
  | "normalAttack"
  | "damageBoost"
  | "bossDamage"
  | "statusDamage"
  | "elementalPower"
  | "ice"
  | "fire"
  | "electric"
  | "dark"
  | "attackPercent"
  | "attackPercentMagic"
  | "attackPercentBoth"
  | "atkSpeed"
  | "cooldown"
  | "hp"
  | "hpPercent"
  | "pDef"
  | "mDef"
  | "str"
  | "int"
  | "otherworld"
  | "resonanceCharge";

export type InsigniaAffix = {
  stat: InsigniaStatKey;
  /** Percent stats stored as 0–1 fractions; flat stats as raw numbers. */
  value: number;
};

/** One owned insignia at a chosen upgrade rank, with the stats of that rank. */
export type InsigniaPiece = {
  id: string;
  name: string;
  rarity: InsigniaRarity;
  /** Equipment slots this insignia can be socketed into. */
  slots: InsigniaSlotId[];
  rank: InsigniaRank;
  affixes: InsigniaAffix[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** An 11-slot insignia loadout. Profiles pick one as the active scheme. */
export type InsigniaScheme = {
  id: string;
  name: string;
  note: string;
  equipped: Partial<Record<InsigniaSlotId, string | null>>;
  createdAt: string;
  updatedAt: string;
};

/**
 * Unified gear + item model. Equipment has a `slot`; catalog items leave it
 * `undefined` (multi-active, slotless). Used by the unified stat-collection
 * path so gear and items share one resolution routine.
 */
export type StatSource = {
  id: string;
  name: string;
  /** undefined = slotless item (multi-active); present = gear bound to that slot id. */
  slot?: string;
  stats: StatBag;
  statLines: string[];
  effects?: string[];
  source?: string;
  demo?: boolean;
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
  /**
   * Flat list of every active gear + item id for this profile, in no
   * particular order. Kept in sync with `equipped`/`itemIds`; the damage
   * path collects stats from these (enforcing one gear per slot).
   */
  activeSourceIds?: string[];
  /** Active circuit scheme id. */
  circuitSchemeId?: string | null;
  /** Active insignia scheme id. */
  insigniaSchemeId?: string | null;
  /** Active advanced class. Cycle comes from the profession catalog. */
  professionId?: ProfessionId | null;
  /**
   * In-game training-dummy number for this build.
   * Compare uses this when set; otherwise the formula dummy.
   */
  observedTrainingDamage?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DamageResult = {
  finalDamage: number;
  /**
   * Training dummy: same formula with 頭目 = 0, then 14000 def reduction.
   * This is the number used for profession ranking.
   */
  trainingDamage: number;
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
  /** Training dummy at an arbitrary def (default 14000), still excluding 頭目. */
  vsTrainingDummy: (monsterDef?: number) => number;
};

export type AppStore = {
  profiles: Profile[];
  equipment: Equipment[];
  items: CatalogItem[];
  compareIds: string[];
  activeProfileId: string | null;
};

/**
 * Flat list of every active gear + item id for a profile, derived from the
 * canonical `equipped`/`itemIds` fields. Used by the unified StatSource
 * damage path (enforcing at most one gear per slot).
 */
export function activeSourceIdsOf(profile: Profile): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of Object.values(profile.equipped)) {
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  for (const id of profile.itemIds) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
