import type {
  BuiltinProfessionId,
  CircuitElement,
  CombatStats,
  DamageResult,
  DamageType,
  ProfessionDef,
  ProfessionFamily,
  ProfessionId,
  ProfessionOverride,
  ProfessionSkill,
  StatBag,
} from "./types";
import { calculateDamage, makeId, resolveEffectiveStats } from "./damage";

export const PROFESSION_FAMILY_LABEL: Record<ProfessionFamily, string> = {
  sword: "劍士",
  gunner: "火槍手",
  mage: "魔導士",
  puppet: "魔偶師",
  fighter: "格鬥家",
  side: "外傳",
};

export const PROFESSION_FAMILIES: ProfessionFamily[] = [
  "sword",
  "gunner",
  "mage",
  "puppet",
  "fighter",
  "side",
];

export const PROFESSION_IDS: BuiltinProfessionId[] = [
  "berserker",
  "mageblade",
  "ghostblade",
  "bounty",
  "artillerist",
  "elementalist",
  "warlock",
  "magician",
  "scythe",
  "puppeteer",
  "cloudheart",
  "heartbreaker",
  "espionage",
  "sonic",
  "elsa",
];

function skill(id: string, name: string): ProfessionSkill {
  return {
    id,
    name,
    percent: 0,
    hits: 1,
    uses: 1,
    enabled: true,
  };
}

function def(partial: Omit<ProfessionDef, "cycleMultiplier" | "cycleSeconds" | "passives"> & {
  cycleMultiplier?: number;
  cycleSeconds?: number;
  passives?: StatBag;
}): ProfessionDef {
  return {
    cycleMultiplier: 1,
    cycleSeconds: 10,
    passives: {},
    ...partial,
  };
}

/**
 * Built-in advanced classes.
 * Default cycle is 1 so existing profiles stay unchanged until the user
 * fills a rotation or calibrates from a 訓練場 number.
 * 物/魔/屬性 are the parts that change ranking out of the box.
 */
export const PROFESSION_CATALOG: ProfessionDef[] = [
  def({
    id: "berserker",
    name: "狂戰士",
    family: "sword",
    damageType: "physical",
    defaultElement: "fire",
    skills: [
      skill("berserker-1", "裂地斬"),
      skill("berserker-2", "旋風"),
      skill("berserker-3", "血刃"),
      skill("berserker-4", "狂怒收尾"),
    ],
    note: "近戰技能輸出。火屬為預設；循環請依自身技能欄校正。",
  }),
  def({
    id: "mageblade",
    name: "魔劍士",
    family: "sword",
    damageType: "magic",
    defaultElement: "electric",
    skills: [
      skill("mageblade-1", "魔刃"),
      skill("mageblade-2", "劍氣"),
      skill("mageblade-3", "元素斬"),
      skill("mageblade-4", "魔劍終結"),
    ],
    note: "走魔攻／智力。預設電屬，可依技能改冰火。",
  }),
  def({
    id: "ghostblade",
    name: "鬼刃",
    family: "sword",
    damageType: "physical",
    defaultElement: "all",
    skills: [
      skill("ghostblade-1", "寒刃"),
      skill("ghostblade-2", "劍鬼"),
      skill("ghostblade-3", "共魄"),
      skill("ghostblade-4", "瞬影擊"),
    ],
    note: "冰火雙屬近戰。寒刃與劍鬼；循環請依自身技能欄校正。",
  }),
  def({
    id: "bounty",
    name: "賞金獵人",
    family: "gunner",
    damageType: "physical",
    defaultElement: "all",
    skills: [
      skill("bounty-1", "連射"),
      skill("bounty-2", "狙擊"),
      skill("bounty-3", "翻滾射擊"),
      skill("bounty-4", "終結彈"),
    ],
    note: "遠程射擊。屬性預設全部；循環請依自身技能欄校正。",
  }),
  def({
    id: "artillerist",
    name: "槍炮師",
    family: "gunner",
    damageType: "physical",
    defaultElement: "fire",
    skills: [
      skill("artillerist-1", "砲擊"),
      skill("artillerist-2", "榴彈"),
      skill("artillerist-3", "過熱連射"),
      skill("artillerist-4", "重砲"),
    ],
    note: "遠程技能砲擊。火屬為預設。",
  }),
  def({
    id: "elementalist",
    name: "元素師",
    family: "mage",
    damageType: "magic",
    defaultElement: "all",
    skills: [
      skill("elementalist-1", "火球"),
      skill("elementalist-2", "冰槍"),
      skill("elementalist-3", "雷暴"),
      skill("elementalist-4", "隕石"),
    ],
    note: "屬性預設「全部」，迴路冰火電都會進屬強。可改成單一屬性對齊技能。",
  }),
  def({
    id: "warlock",
    name: "詭術師",
    family: "mage",
    damageType: "magic",
    defaultElement: "dark",
    skills: [
      skill("warlock-1", "暗焰"),
      skill("warlock-2", "咒怨"),
      skill("warlock-3", "束縛"),
      skill("warlock-4", "暗焰爆發"),
    ],
    note: "暗屬技能。暗屬迴路／徽記會拉開與其他法系的差距。",
  }),
  def({
    id: "magician",
    name: "魔術師",
    family: "mage",
    damageType: "magic",
    defaultElement: "electric",
    skills: [
      skill("magician-1", "卡牌"),
      skill("magician-2", "魔術彈"),
      skill("magician-3", "幻影"),
      skill("magician-4", "大魔術"),
    ],
    note: "遠程法系，預設電屬。",
  }),
  def({
    id: "scythe",
    name: "鐮衛",
    family: "puppet",
    damageType: "physical",
    defaultElement: "dark",
    skills: [
      skill("scythe-1", "死亡旋舞"),
      skill("scythe-2", "鐮擊"),
      skill("scythe-3", "收割"),
      skill("scythe-4", "終焉"),
    ],
    note: "近戰技能，預設暗屬。",
  }),
  def({
    id: "puppeteer",
    name: "劍侍",
    family: "puppet",
    damageType: "physical",
    defaultElement: "all",
    skills: [
      skill("puppeteer-1", "人偶連攜"),
      skill("puppeteer-2", "換位斬"),
      skill("puppeteer-3", "人偶普攻"),
      skill("puppeteer-4", "連攜終結"),
    ],
    note: "人偶連攜。屬性預設全部。",
  }),
  def({
    id: "cloudheart",
    name: "雲心",
    family: "fighter",
    damageType: "physical",
    defaultElement: "all",
    skills: [
      skill("cloudheart-1", "掌勁"),
      skill("cloudheart-2", "連拳"),
      skill("cloudheart-3", "雲步"),
      skill("cloudheart-4", "崩山"),
    ],
    note: "格鬥技能輸出。",
  }),
  def({
    id: "heartbreaker",
    name: "碎心",
    family: "fighter",
    damageType: "physical",
    defaultElement: "all",
    skills: [
      skill("heartbreaker-1", "碎擊"),
      skill("heartbreaker-2", "連打"),
      skill("heartbreaker-3", "爆裂拳"),
      skill("heartbreaker-4", "碎心終結"),
    ],
    note: "格鬥近戰。屬性預設全部。",
  }),
  def({
    id: "espionage",
    name: "諜影",
    family: "side",
    damageType: "physical",
    defaultElement: "electric",
    skills: [
      skill("espionage-1", "震彈槍"),
      skill("espionage-2", "狙擊槍"),
      skill("espionage-3", "浮游砲"),
      skill("espionage-4", "機車火力"),
    ],
    note: "四武器循環。預設電屬；請用訓練場數字校正一套倍率。",
  }),
  def({
    id: "sonic",
    name: "音爆",
    family: "side",
    damageType: "physical",
    defaultElement: "electric",
    skills: [
      skill("sonic-1", "音波"),
      skill("sonic-2", "節拍"),
      skill("sonic-3", "共鳴爆"),
      skill("sonic-4", "高潮"),
    ],
    note: "外傳職業，預設電屬。",
  }),
  def({
    id: "elsa",
    name: "艾爾莎",
    family: "side",
    damageType: "magic",
    defaultElement: "all",
    skills: [
      skill("elsa-1", "誓光"),
      skill("elsa-2", "餘燼"),
      skill("elsa-3", "長夜"),
      skill("elsa-4", "誓約"),
    ],
    note: "外傳法系。無獨立光屬，屬性預設全部。",
  }),
];

const CATALOG_BY_ID = new Map(PROFESSION_CATALOG.map((p) => [p.id, p]));
const BUILTIN_IDS = new Set<string>(PROFESSION_IDS);

export function isBuiltinProfessionId(value: unknown): value is BuiltinProfessionId {
  return typeof value === "string" && BUILTIN_IDS.has(value);
}

export function isProfessionId(value: unknown): value is ProfessionId {
  return typeof value === "string" && value.trim().length > 0;
}

export function isProfessionFamily(value: unknown): value is ProfessionFamily {
  return (
    value === "sword" ||
    value === "gunner" ||
    value === "mage" ||
    value === "puppet" ||
    value === "fighter" ||
    value === "side"
  );
}

export function professionById(id: ProfessionId | null | undefined): ProfessionDef | null {
  if (!id) return null;
  return CATALOG_BY_ID.get(id) ?? null;
}

export function findProfession(
  id: ProfessionId | null | undefined,
  custom: ProfessionDef[] = [],
): ProfessionDef | null {
  if (!id) return null;
  return professionById(id) ?? custom.find((p) => p.id === id) ?? null;
}

export function listProfessions(custom: ProfessionDef[] = []): ProfessionDef[] {
  const extras = custom.filter((p) => p.id && !BUILTIN_IDS.has(p.id));
  return [...PROFESSION_CATALOG, ...extras];
}

export function createCustomProfession(
  input: {
    name: string;
    family?: ProfessionFamily;
    damageType?: DamageType;
    defaultElement?: CircuitElement | "all";
    note?: string;
  },
  existing: ProfessionDef[] = [],
): ProfessionDef {
  const name = input.name.trim() || "新職業";
  const taken = new Set<string>([...PROFESSION_IDS, ...existing.map((p) => p.id)]);
  let id = makeId("job");
  while (taken.has(id)) id = makeId("job");
  return {
    id,
    name,
    family: input.family && isProfessionFamily(input.family) ? input.family : "sword",
    damageType: input.damageType === "magic" ? "magic" : "physical",
    defaultElement: parseProfessionElement(input.defaultElement),
    cycleMultiplier: 1,
    cycleSeconds: 10,
    skills: [
      skill(`${id}-1`, "技能 1"),
      skill(`${id}-2`, "技能 2"),
      skill(`${id}-3`, "技能 3"),
      skill(`${id}-4`, "技能 4"),
    ],
    passives: {},
    note: typeof input.note === "string" ? input.note : "",
  };
}

function parseProfessionElement(raw: unknown): CircuitElement | "all" {
  if (raw === "ice" || raw === "fire" || raw === "electric" || raw === "dark") {
    return raw;
  }
  return "all";
}

export function upsertCustomProfession(
  list: ProfessionDef[],
  profession: ProfessionDef,
): ProfessionDef[] {
  if (isBuiltinProfessionId(profession.id)) return list;
  const idx = list.findIndex((p) => p.id === profession.id);
  if (idx < 0) return [...list, profession];
  const next = [...list];
  next[idx] = profession;
  return next;
}

export function removeCustomProfession(
  list: ProfessionDef[],
  id: ProfessionId,
): ProfessionDef[] {
  return list.filter((p) => p.id !== id);
}

export function professionLabel(id: ProfessionId | null | undefined): string {
  return professionById(id)?.name ?? "未選職業";
}

export function cycleMultiplierFromSkills(skills: ProfessionSkill[]): number {
  let total = 0;
  for (const row of skills) {
    if (!row.enabled) continue;
    const percent = Number(row.percent);
    const hits = Number(row.hits);
    const uses = Number(row.uses);
    if (!Number.isFinite(percent) || !Number.isFinite(hits) || !Number.isFinite(uses)) {
      continue;
    }
    total += (percent / 100) * hits * uses;
  }
  return total;
}

export function resolvedCycleMultiplier(
  cycleMultiplier: number,
  skills: ProfessionSkill[],
): number {
  const fromSkills = cycleMultiplierFromSkills(skills);
  if (fromSkills > 0) return fromSkills;
  if (Number.isFinite(cycleMultiplier) && cycleMultiplier > 0) return cycleMultiplier;
  return 1;
}

function cloneSkills(skills: ProfessionSkill[]): ProfessionSkill[] {
  return skills.map((s) => ({ ...s }));
}

export function resolveProfession(
  id: ProfessionId | null | undefined,
  overrides: ProfessionOverride[] = [],
  custom: ProfessionDef[] = [],
): ProfessionDef | null {
  const base = findProfession(id, custom);
  if (!base) return null;
  const patch = overrides.find((o) => o.id === base.id);
  if (!patch) {
    return {
      ...base,
      skills: cloneSkills(base.skills),
      passives: { ...base.passives },
    };
  }
  const skills = patch.skills?.length ? cloneSkills(patch.skills) : cloneSkills(base.skills);
  return {
    ...base,
    cycleMultiplier:
      patch.cycleMultiplier != null && Number.isFinite(patch.cycleMultiplier)
        ? patch.cycleMultiplier
        : base.cycleMultiplier,
    cycleSeconds:
      patch.cycleSeconds != null && Number.isFinite(patch.cycleSeconds) && patch.cycleSeconds > 0
        ? patch.cycleSeconds
        : base.cycleSeconds,
    skills,
    note: patch.note ?? base.note,
    passives: { ...base.passives },
  };
}

export function upsertProfessionOverride(
  list: ProfessionOverride[],
  patch: ProfessionOverride,
): ProfessionOverride[] {
  const idx = list.findIndex((o) => o.id === patch.id);
  if (idx < 0) return [...list, patch];
  const next = [...list];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

export function resetProfessionOverride(
  list: ProfessionOverride[],
  id: ProfessionId,
): ProfessionOverride[] {
  return list.filter((o) => o.id !== id);
}

export function applyProfessionCycle(
  stats: CombatStats,
  profession: ProfessionDef | null,
): { stats: CombatStats; cycleMultiplier: number } {
  if (!profession) {
    return { stats, cycleMultiplier: 1 };
  }
  const cycle = resolvedCycleMultiplier(profession.cycleMultiplier, profession.skills);
  return {
    stats: {
      ...stats,
      skillMultiplier: (stats.skillMultiplier || 1) * cycle,
    },
    cycleMultiplier: cycle,
  };
}

export function evaluateResolvedStats(
  stats: CombatStats,
  profession: ProfessionDef | null,
): DamageResult {
  const applied = applyProfessionCycle(stats, profession);
  return calculateDamage(applied.stats);
}

export type ProfessionEvalInput = {
  base: CombatStats;
  bags: StatBag[];
  damageType: DamageType;
  profession: ProfessionDef | null;
};

export function evaluateProfessionConfig(input: ProfessionEvalInput): DamageResult {
  const bags = [...input.bags];
  if (input.profession && hasPassive(input.profession.passives)) {
    bags.push(input.profession.passives);
  }
  const effective = resolveEffectiveStats(input.base, bags, input.damageType);
  return evaluateResolvedStats(effective, input.profession);
}

export type ProfessionRankRow = {
  profession: ProfessionDef;
  result: DamageResult;
  cycleMultiplier: number;
  damageType: DamageType;
  element: CircuitElement | "all";
  trainingDps: number;
  ratioOfBest: number;
  rank: number;
};

export function rankProfessions(
  rows: Array<Omit<ProfessionRankRow, "ratioOfBest" | "rank">>,
): ProfessionRankRow[] {
  const sorted = [...rows].sort(
    (a, b) => b.result.trainingDamage - a.result.trainingDamage,
  );
  const best = sorted[0]?.result.trainingDamage ?? 0;
  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    ratioOfBest: best > 0 ? row.result.trainingDamage / best : 0,
  }));
}

/** Solve cycle so training dummy matches an observed in-game number. */
export function calibrateCycleMultiplier(
  observedTrainingDamage: number,
  trainingDamageAtCycle1: number,
): number {
  if (!Number.isFinite(observedTrainingDamage) || observedTrainingDamage <= 0) {
    return 1;
  }
  if (!Number.isFinite(trainingDamageAtCycle1) || trainingDamageAtCycle1 <= 0) {
    return 1;
  }
  return observedTrainingDamage / trainingDamageAtCycle1;
}

export function normalizeCustomProfession(raw: unknown): ProfessionDef | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.id !== "string" || !src.id.trim()) return null;
  if (isBuiltinProfessionId(src.id)) return null;
  const name = typeof src.name === "string" ? src.name.trim() : "";
  if (!name) return null;
  const cycleMultiplier = Number(src.cycleMultiplier);
  const cycleSeconds = Number(src.cycleSeconds);
  const skills = Array.isArray(src.skills)
    ? src.skills.map(normalizeSkill).filter((s): s is ProfessionSkill => s !== null)
    : [];
  return {
    id: src.id.trim(),
    name,
    family: isProfessionFamily(src.family) ? src.family : "sword",
    damageType: src.damageType === "magic" ? "magic" : "physical",
    defaultElement: parseProfessionElement(src.defaultElement),
    cycleMultiplier:
      Number.isFinite(cycleMultiplier) && cycleMultiplier > 0 ? cycleMultiplier : 1,
    cycleSeconds: Number.isFinite(cycleSeconds) && cycleSeconds > 0 ? cycleSeconds : 10,
    skills,
    passives: {},
    note: typeof src.note === "string" ? src.note : "",
  };
}

export function normalizeProfessionOverride(
  raw: unknown,
): ProfessionOverride | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.id !== "string" || !src.id.trim()) return null;
  const out: ProfessionOverride = { id: src.id.trim() };
  if (typeof src.cycleMultiplier === "number" && Number.isFinite(src.cycleMultiplier)) {
    out.cycleMultiplier = src.cycleMultiplier;
  }
  if (typeof src.cycleSeconds === "number" && Number.isFinite(src.cycleSeconds) && src.cycleSeconds > 0) {
    out.cycleSeconds = src.cycleSeconds;
  }
  if (typeof src.note === "string") out.note = src.note;
  if (Array.isArray(src.skills)) {
    const skills = src.skills
      .map(normalizeSkill)
      .filter((s): s is ProfessionSkill => s !== null);
    if (skills.length) out.skills = skills;
  }
  return out;
}

function normalizeSkill(raw: unknown): ProfessionSkill | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const name = typeof src.name === "string" ? src.name.trim() : "";
  if (!name) return null;
  const percent = Number(src.percent);
  const hits = Number(src.hits);
  const uses = Number(src.uses);
  return {
    id: typeof src.id === "string" && src.id ? src.id : makeId("ps"),
    name,
    percent: Number.isFinite(percent) ? percent : 0,
    hits: Number.isFinite(hits) && hits > 0 ? hits : 1,
    uses: Number.isFinite(uses) && uses > 0 ? uses : 1,
    enabled: src.enabled !== false,
  };
}

function hasPassive(bag: StatBag): boolean {
  return Object.values(bag).some(
    (v) => typeof v === "number" && Number.isFinite(v) && v !== 0,
  );
}

