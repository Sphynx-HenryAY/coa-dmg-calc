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

export type Profile = {
  id: string;
  name: string;
  note: string;
  damageType: DamageType;
  /** Base stats before selected gear/items. */
  base: CombatStats;
  /** slot -> equipment id */
  equipped: Record<string, string | null>;
  /** selected item ids */
  itemIds: string[];
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
