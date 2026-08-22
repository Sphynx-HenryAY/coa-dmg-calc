import type { CombatStats, DamageResult, StatBag, DamageType } from "./types";

/** Training dummy defense used by the siumai sheet / in-game 訓練場. */
export const TRAINING_DUMMY_DEF = 14000;

type DamageFactors = DamageResult["factors"] & { finalDamage: number };

function computeFactors(
  stats: CombatStats,
  bossDamage: number,
): DamageFactors {
  const {
    attack: c,
    defenseBreak: d,
    critRate: e,
    critDamage: f,
    elementalPower: g,
    skillDamage: h,
    resonance: i,
    damageBoost: j,
    circuitBoost: k,
    allElementDamage: l,
    additionalDamage: m,
    statusDamage: n,
    trainingCorrection: q,
    skillMultiplier: r,
  } = stats;

  const critRate = clamp(e, 0, 1);
  const atkBreak = c + d;
  const critFactor = critRate * (1 + f) + (1 - critRate);
  const elemental = 1 + g / 220;
  const normal = stats.normalAttackDamage ?? 0;
  const skillResonance = 1 + h + normal + i;
  const damageBoost = 1 + j;
  const circuit = 1 + k;
  const allElement = 1 + l;
  const additional = 1 + m;
  const statusBoss = 1 + n + bossDamage;
  const training = 1 + q;
  const skillMultiplier = r;

  const finalDamage =
    atkBreak *
    critFactor *
    elemental *
    skillResonance *
    damageBoost *
    circuit *
    allElement *
    additional *
    statusBoss *
    training *
    skillMultiplier;

  return {
    finalDamage,
    atkBreak,
    critFactor,
    elemental,
    skillResonance,
    damageBoost,
    circuit,
    allElement,
    additional,
    statusBoss,
    training,
    skillMultiplier,
  };
}

/** Matches siumai 傷害 sheet final-damage formula. */
export function calculateDamage(stats: CombatStats): DamageResult {
  const main = computeFactors(stats, stats.bossDamage);
  const training = computeFactors(stats, 0);
  const critRate = clamp(stats.critRate, 0, 1);

  return {
    finalDamage: main.finalDamage,
    trainingDamage: damageVsMonster(
      training.finalDamage,
      stats.attack,
      stats.defenseBreak,
      stats.penetration,
      TRAINING_DUMMY_DEF,
    ),
    factors: {
      atkBreak: main.atkBreak,
      critFactor: main.critFactor,
      elemental: main.elemental,
      skillResonance: main.skillResonance,
      damageBoost: main.damageBoost,
      circuit: main.circuit,
      allElement: main.allElement,
      additional: main.additional,
      statusBoss: main.statusBoss,
      training: main.training,
      skillMultiplier: main.skillMultiplier,
    },
    effectiveStats: { ...stats, critRate },
    vsMonster: (monsterDef: number) =>
      damageVsMonster(
        main.finalDamage,
        stats.attack,
        stats.defenseBreak,
        stats.penetration,
        monsterDef,
      ),
    vsTrainingDummy: (monsterDef = TRAINING_DUMMY_DEF) =>
      damageVsMonster(
        training.finalDamage,
        stats.attack,
        stats.defenseBreak,
        stats.penetration,
        monsterDef,
      ),
  };
}

/**
 * 對國王攻擊 style reduction used in the sheet:
 * S * ((1 - (def*(1-pen)/(3000+def*(1-pen)))) * ATK + 破防) / (ATK + 破防)
 */
export function damageVsMonster(
  finalDamage: number,
  attack: number,
  defenseBreak: number,
  penetration: number,
  monsterDef: number,
): number {
  const pen = clamp(penetration, 0, 0.99);
  const effectiveDef = monsterDef * (1 - pen);
  const reduction = effectiveDef / (3000 + effectiveDef);
  const weighted =
    ((1 - reduction) * attack + defenseBreak) / Math.max(attack + defenseBreak, 1e-9);
  return finalDamage * weighted;
}

export function emptyStats(): CombatStats {
  return {
    attack: 0,
    defenseBreak: 0,
    critRate: 0,
    critDamage: 0,
    elementalPower: 0,
    skillDamage: 0,
    resonance: 0,
    damageBoost: 0,
    circuitBoost: 0,
    allElementDamage: 0,
    additionalDamage: 0,
    statusDamage: 0,
    bossDamage: 0,
    penetration: 0,
    trainingCorrection: 0,
    skillMultiplier: 1,
    attackPercent: 0,
    physicalAttack: 0,
    magicAttack: 0,
    normalAttackDamage: 0,
  };
}

export function addStats(a: CombatStats, bag: StatBag, damageType: DamageType): CombatStats {
  const out: CombatStats = { ...a };

  const pickCrit =
    damageType === "magic"
      ? bag.critRateMagic ?? bag.critRate ?? 0
      : bag.critRate ?? bag.critRateMagic ?? 0;

  const pickPen =
    damageType === "magic"
      ? bag.penetrationMagic ?? bag.penetration ?? 0
      : bag.penetration ?? bag.penetrationMagic ?? 0;

  // 攻擊% from gear still stacks additively with 力量/智力.
  // 物攻/魔攻 as attributes are flat (physicalAttack / magicAttack), not %.
  const pickAtkPct =
    damageType === "magic"
      ? (bag.attackPercentMagic ?? 0) +
        (bag.attackPercent ?? 0) +
        (bag.intPercent ?? 0)
      : (bag.attackPercent ?? 0) +
        (bag.attackPercentMagic ?? 0) +
        (bag.strPercent ?? 0);

  out.critRate += pickCrit;
  out.penetration += pickPen;
  out.attackPercent = (out.attackPercent ?? 0) + pickAtkPct;
  if (bag.physicalAttack) {
    out.physicalAttack = (out.physicalAttack ?? 0) + bag.physicalAttack;
  }
  if (bag.magicAttack) {
    out.magicAttack = (out.magicAttack ?? 0) + bag.magicAttack;
  }

  if (bag.defenseBreak) out.defenseBreak += bag.defenseBreak;
  if (bag.critDamage) out.critDamage += bag.critDamage;
  if (bag.elementalPower) out.elementalPower += bag.elementalPower;
  if (bag.skillDamage) out.skillDamage += bag.skillDamage;
  if (bag.resonance) out.resonance += bag.resonance;
  if (bag.damageBoost) out.damageBoost += bag.damageBoost;
  if (bag.circuitBoost) out.circuitBoost += bag.circuitBoost;
  if (bag.allElementDamage) out.allElementDamage += bag.allElementDamage;
  if (bag.additionalDamage) out.additionalDamage += bag.additionalDamage;
  if (bag.statusDamage) out.statusDamage += bag.statusDamage;
  if (bag.bossDamage) out.bossDamage += bag.bossDamage;
  if (bag.trainingCorrection) out.trainingCorrection += bag.trainingCorrection;
  if (bag.skillMultiplier != null && bag.skillMultiplier !== 0) {
    // skill multiplier is multiplicative when stacking sources that set it
    if (bag.skillMultiplier !== 1) {
      out.skillMultiplier *= bag.skillMultiplier;
    }
  }
  if (bag.normalAttackDamage) {
    out.normalAttackDamage = (out.normalAttackDamage ?? 0) + bag.normalAttackDamage;
  }
  if (bag.attack) out.attack += bag.attack;

  return out;
}

/**
 * Apply base + equipment/item/circuit bags, then resolve final attack:
 *   攻擊力 adds to both 物攻 and 魔攻 bases
 *   物攻 / 魔攻 attributes add flat base (not %)
 *   最終攻擊 = (攻擊力 + 對應物攻或魔攻) × (1 + 力量或智力 + 裝備攻擊%)
 */
export function resolveEffectiveStats(
  base: CombatStats,
  bags: StatBag[],
  damageType: DamageType,
): CombatStats {
  let stats: CombatStats = {
    ...base,
    attackPercent: 0,
    physicalAttack: base.physicalAttack ?? 0,
    magicAttack: base.magicAttack ?? 0,
    normalAttackDamage: base.normalAttackDamage ?? 0,
  };
  for (const bag of bags) {
    stats = addStats(stats, bag, damageType);
  }
  const sharedAtk = stats.attack;
  const pAtk = sharedAtk + (stats.physicalAttack ?? 0);
  const mAtk = sharedAtk + (stats.magicAttack ?? 0);
  stats.physicalAttack = pAtk;
  stats.magicAttack = mAtk;
  const typedBase = damageType === "magic" ? mAtk : pAtk;
  const atkPct = stats.attackPercent ?? 0;
  stats.attack = typedBase * (1 + atkPct);
  stats.critRate = clamp(stats.critRate, 0, 1);
  return stats;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export const STAT_LABELS: Record<keyof CombatStats, string> = {
  attack: "攻擊",
  physicalAttack: "物攻",
  magicAttack: "魔攻",
  defenseBreak: "破防",
  critRate: "暴率",
  critDamage: "爆傷",
  elementalPower: "屬強",
  skillDamage: "技傷",
  resonance: "共鳴",
  damageBoost: "提傷",
  circuitBoost: "迴路增傷",
  allElementDamage: "全屬性傷害",
  additionalDamage: "附加傷害",
  statusDamage: "異常",
  bossDamage: "頭目",
  penetration: "穿透",
  trainingCorrection: "訓練場修正",
  skillMultiplier: "技能倍率",
  attackPercent: "攻擊%",
  normalAttackDamage: "普攻傷害",
};

export const PERCENT_STATS = new Set<keyof CombatStats>([
  "critRate",
  "critDamage",
  "skillDamage",
  "resonance",
  "damageBoost",
  "circuitBoost",
  "allElementDamage",
  "additionalDamage",
  "statusDamage",
  "bossDamage",
  "penetration",
  "trainingCorrection",
  "attackPercent",
  "normalAttackDamage",
]);

export function mergeStatBags(bags: StatBag[]): StatBag {
  const out: StatBag = {};
  for (const bag of bags) {
    for (const [key, raw] of Object.entries(bag)) {
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw === 0) continue;
      const prev = (out as Record<string, number>)[key] ?? 0;
      (out as Record<string, number>)[key] = prev + raw;
    }
  }
  return out;
}

/** Direct combat-stat additions from a bag (no final-attack resolve). */
export function bagToStatBonuses(
  bag: StatBag,
  damageType: DamageType,
): Partial<Record<keyof CombatStats, number>> {
  const added = addStats(emptyStats(), bag, damageType);
  const out: Partial<Record<keyof CombatStats, number>> = {};
  for (const key of Object.keys(STAT_LABELS) as Array<keyof CombatStats>) {
    const value = Number(added[key] ?? 0);
    if (!Number.isFinite(value)) continue;
    if (key === "skillMultiplier") {
      if (value !== 1) out[key] = value;
      continue;
    }
    if (value !== 0) out[key] = value;
  }
  return out;
}

export function formatSignedStatValue(
  key: keyof CombatStats,
  value: number,
): string {
  const abs = formatStatValue(key, Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

export function formatStatValue(key: keyof CombatStats, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (key === "skillMultiplier") return value.toFixed(3);
  if (
    key === "elementalPower" ||
    key === "attack" ||
    key === "defenseBreak" ||
    key === "physicalAttack" ||
    key === "magicAttack"
  ) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  if (PERCENT_STATS.has(key)) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return String(value);
}

export function formatDamage(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

export function makeId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
