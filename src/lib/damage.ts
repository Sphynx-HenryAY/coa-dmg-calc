import type { CombatStats, DamageResult, StatBag, DamageType } from "./types";

/** Matches siumai 傷害 sheet final-damage formula. */
export function calculateDamage(stats: CombatStats): DamageResult {
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
    bossDamage: o,
    trainingCorrection: q,
    skillMultiplier: r,
  } = stats;

  const critRate = clamp(e, 0, 1);
  const atkBreak = c + d;
  const critFactor = critRate * (1 + f) + (1 - critRate);
  const elemental = 1 + g / 220;
  const skillResonance = 1 + h + i;
  const damageBoost = 1 + j;
  const circuit = 1 + k;
  const allElement = 1 + l;
  const additional = 1 + m;
  const statusBoss = 1 + n + o;
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
    factors: {
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
    },
    effectiveStats: { ...stats, critRate },
    vsMonster: (monsterDef: number) =>
      damageVsMonster(finalDamage, c, d, stats.penetration, monsterDef),
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

/** Apply base + equipment/item bags, then convert attack% into effective attack. */
export function resolveEffectiveStats(
  base: CombatStats,
  bags: StatBag[],
  damageType: DamageType,
): CombatStats {
  let stats: CombatStats = {
    ...base,
    attackPercent: 0,
    normalAttackDamage: base.normalAttackDamage ?? 0,
  };
  for (const bag of bags) {
    stats = addStats(stats, bag, damageType);
  }
  const atkPct = stats.attackPercent ?? 0;
  stats.attack = stats.attack * (1 + atkPct);
  stats.critRate = clamp(stats.critRate, 0, 1);
  return stats;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export const STAT_LABELS: Record<keyof CombatStats, string> = {
  attack: "攻擊",
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

export function formatStatValue(key: keyof CombatStats, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (key === "skillMultiplier") return value.toFixed(3);
  if (key === "elementalPower" || key === "attack" || key === "defenseBreak") {
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
