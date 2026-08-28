import { makeId } from "./damage";
import {
  CIRCUIT_SLOT_IDS,
  type CircuitExtraStats,
} from "./circuit";
import {
  addToBag,
  assignToSlot as loadoutAssignToSlot,
  compareLoadout,
  countEquipped,
  detachFromSchemes as loadoutDetach,
  genericSchemeContribution,
  listEquipped,
  unequipPiece,
  type LoadoutComparison,
  type LoadoutContribution,
  type LoadoutEquipped,
  type LoadoutSlotGain,
  type LoadoutSwapGain,
} from "./loadout";
import {
  affixLines,
  slotHint as slotHintImpl,
  trimNum,
} from "./format";
import { parseStatInput, statInputValue } from "./statInput";
import {
  circuitElementLabel,
  insigniaRarityLabel,
  insigniaStatLabel,
  m,
  slotLabel,
} from "./i18n";
import type {
  CircuitElement,
  InsigniaAffix,
  InsigniaPiece,
  InsigniaRank,
  InsigniaRarity,
  InsigniaScheme,
  InsigniaSlotId,
  InsigniaStatKey,
  StatBag,
} from "./types";

export const INSIGNIA_RARITY_LABEL: Record<InsigniaRarity, string> = {
  epic: "史詩",
  rare: "稀有",
};

export const INSIGNIA_SLOT_IDS: InsigniaSlotId[] = CIRCUIT_SLOT_IDS;

export const INSIGNIA_SLOT_GROUPS: Array<{
  group: string;
  slots: InsigniaSlotId[];
}> = [
  { group: "防具", slots: ["頭", "手", "腳", "上衣", "褲子"] },
  { group: "飾品", slots: ["印章", "護符", "武器", "項鍊", "護腕", "戒指"] },
];

export const INSIGNIA_STAT_LABEL: Record<InsigniaStatKey, string> = {
  critRate: "暴率",
  critDamage: "暴傷",
  skillDamage: "技能傷害",
  normalAttack: "普攻傷害",
  damageBoost: "傷害提升",
  bossDamage: "頭目傷害",
  statusDamage: "異常傷害",
  elementalPower: "全屬性",
  ice: "冰屬",
  fire: "火屬",
  electric: "電屬",
  dark: "暗屬",
  attackPercent: "物攻%",
  attackPercentMagic: "魔攻%",
  attackPercentBoth: "物攻%+魔攻%",
  atkSpeed: "攻速",
  cooldown: "冷卻",
  hp: "生命值",
  hpPercent: "生命%",
  pDef: "物防%",
  mDef: "魔防%",
  str: "力量",
  int: "智力",
  otherworld: "異界傷害",
  resonanceCharge: "共鳴充能",
  petDamage: "寵物增傷",
  allElementDamage: "全屬性傷害",
  additionalDamage: "附加傷害",
};

/** Stats entered/displayed as percentages. */
export const INSIGNIA_PERCENT_STATS = new Set<InsigniaStatKey>([
  "critRate",
  "critDamage",
  "skillDamage",
  "normalAttack",
  "damageBoost",
  "bossDamage",
  "statusDamage",
  "attackPercent",
  "attackPercentMagic",
  "attackPercentBoth",
  "atkSpeed",
  "cooldown",
  "hpPercent",
  "pDef",
  "mDef",
  "otherworld",
  "resonanceCharge",
  "petDamage",
  "allElementDamage",
  "additionalDamage",
]);

export const INSIGNIA_ELEMENT_STATS = new Set<InsigniaStatKey>([
  "ice",
  "fire",
  "electric",
  "dark",
]);

/** All selectable affixes, damage-relevant first. */
export const INSIGNIA_STAT_OPTIONS: InsigniaStatKey[] = [
  "critDamage",
  "critRate",
  "skillDamage",
  "normalAttack",
  "damageBoost",
  "bossDamage",
  "statusDamage",
  "elementalPower",
  "attackPercentBoth",
  "attackPercent",
  "attackPercentMagic",
  "ice",
  "fire",
  "electric",
  "dark",
  "atkSpeed",
  "cooldown",
  "hp",
  "hpPercent",
  "pDef",
  "mDef",
  "str",
  "int",
  "otherworld",
  "resonanceCharge",
  "petDamage",
  "allElementDamage",
  "additionalDamage",
];

export const INSIGNIA_RANKS: InsigniaRank[] = [1, 2, 3];

export function isInsigniaSlotId(value: string): value is InsigniaSlotId {
  return (INSIGNIA_SLOT_IDS as string[]).includes(value);
}

export function blankInsigniaPiece(
  rarity: InsigniaRarity = "epic",
): InsigniaPiece {
  const now = new Date().toISOString();
  return {
    id: makeId("insignia"),
    name: "",
    rarity,
    slots: [],
    rank: 3,
    affixes: [],
    note: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blankInsigniaScheme(name = m().newScheme): InsigniaScheme {
  const now = new Date().toISOString();
  return {
    id: makeId("ischeme"),
    name,
    note: "",
    equipped: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultInsigniaName(
  piece: Pick<InsigniaPiece, "rarity" | "affixes">,
): string {
  const first = piece.affixes[0];
  const affix = first ? formatInsigniaAffix(first) : m().noAffix;
  return `${insigniaRarityLabel(piece.rarity)} · ${affix}`;
}

export function formatInsigniaAffix(affix: InsigniaAffix): string {
  return `${insigniaStatLabel(affix.stat)} ${formatInsigniaStatValue(affix.stat, affix.value)}`;
}

export function formatInsigniaStatValue(
  stat: InsigniaStatKey,
  value: number,
): string {
  if (!Number.isFinite(value)) return "—";
  if (INSIGNIA_PERCENT_STATS.has(stat)) {
    const pct = Math.round(value * 10000) / 100;
    return `+${trimNum(pct)}%`;
  }
  return `+${trimNum(value)}`;
}

export function insigniaInputValue(
  stat: InsigniaStatKey,
  stored: number,
): number {
  return statInputValue(stat, stored, INSIGNIA_PERCENT_STATS);
}

export function parseInsigniaInput(
  stat: InsigniaStatKey,
  raw: string,
): number {
  return parseStatInput(stat, raw, INSIGNIA_PERCENT_STATS);
}

export function pieceStatLines(piece: InsigniaPiece): string[] {
  return affixLines([{ prefix: "", affixes: piece.affixes }], formatInsigniaAffix);
}

export function slotHint(slots: InsigniaSlotId[]): string {
  return slotHintImpl(slots, slotLabel, m().unspecifiedSlots);
}

export function canSocketIn(
  piece: InsigniaPiece,
  slot: InsigniaSlotId,
): boolean {
  return piece.slots.includes(slot);
}

const ELEMENT_STAT_TO_KEY: Partial<Record<InsigniaStatKey, CircuitElement>> = {
  ice: "ice",
  fire: "fire",
  electric: "electric",
  dark: "dark",
};

export type InsigniaExtraStats = CircuitExtraStats & {
  hpPercent: number;
  otherworld: number;
  resonanceCharge: number;
  str: number;
  int: number;
};

export type InsigniaContribution = LoadoutContribution<InsigniaExtraStats>;

export function emptyExtra(): InsigniaExtraStats {
  return {
    hp: 0,
    vit: 0,
    agi: 0,
    spr: 0,
    pDef: 0,
    mDef: 0,
    atkSpeed: 0,
    cooldown: 0,
    agiSpr: 0,
    unusedElement: {},
    hpPercent: 0,
    otherworld: 0,
    resonanceCharge: 0,
    str: 0,
    int: 0,
  };
}

/**
 * Map one insignia affix onto the damage StatBag (or extra, non-damage totals).
 */
export function applyInsigniaAffix(
  affix: InsigniaAffix,
  bag: StatBag,
  extra: InsigniaExtraStats,
  element: CircuitElement | "all",
): void {
  const { stat, value } = affix;
  if (!Number.isFinite(value) || value === 0) return;

  const elem = ELEMENT_STAT_TO_KEY[stat];
  if (elem) {
    if (element === "all" || element === elem) {
      addToBag(bag, "elementalPower", value);
    } else {
      extra.unusedElement[elem] = (extra.unusedElement[elem] ?? 0) + value;
    }
    return;
  }

  switch (stat) {
    case "critRate":
      addToBag(bag, "critRate", value);
      return;
    case "critDamage":
      addToBag(bag, "critDamage", value);
      return;
    case "skillDamage":
      addToBag(bag, "skillDamage", value);
      return;
    case "normalAttack":
      addToBag(bag, "normalAttackDamage", value);
      return;
    case "damageBoost":
      addToBag(bag, "damageBoost", value);
      return;
    case "bossDamage":
      addToBag(bag, "bossDamage", value);
      return;
    case "statusDamage":
      addToBag(bag, "statusDamage", value);
      return;
    case "elementalPower":
      addToBag(bag, "elementalPower", value);
      return;
    case "attackPercent":
      addToBag(bag, "attackPercent", value);
      return;
    case "attackPercentMagic":
      addToBag(bag, "attackPercentMagic", value);
      return;
    case "attackPercentBoth":
      addToBag(bag, "attackPercent", value);
      addToBag(bag, "attackPercentMagic", value);
      return;
    case "atkSpeed":
      extra.atkSpeed += value;
      addToBag(bag, "attackSpeed", value);
      return;
    case "cooldown":
      extra.cooldown += value;
      addToBag(bag, "cooldownSpeed", value);
      return;
    case "hp":
      extra.hp += value;
      return;
    case "hpPercent":
      extra.hpPercent += value;
      return;
    case "pDef":
      extra.pDef += value;
      return;
    case "mDef":
      extra.mDef += value;
      return;
    case "str":
      extra.str += value;
      return;
    case "int":
      extra.int += value;
      return;
    case "otherworld":
      extra.otherworld += value;
      return;
    case "resonanceCharge":
      extra.resonanceCharge += value;
      addToBag(bag, "resonanceCharge", value);
      return;
    case "petDamage":
      addToBag(bag, "petDamage", value);
      return;
    case "allElementDamage":
      addToBag(bag, "allElementDamage", value);
      return;
    case "additionalDamage":
      addToBag(bag, "additionalDamage", value);
      return;
    default:
      return;
  }
}

export function pieceContribution(
  piece: InsigniaPiece,
  element: CircuitElement | "all",
): InsigniaContribution {
  const bag: StatBag = {};
  const extra = emptyExtra();
  for (const affix of piece.affixes) {
    applyInsigniaAffix(affix, bag, extra, element);
  }
  return { bag, extra };
}

export function mergeExtra(
  a: InsigniaExtraStats,
  b: InsigniaExtraStats,
): InsigniaExtraStats {
  const unusedElement: Partial<Record<CircuitElement, number>> = {
    ...a.unusedElement,
  };
  for (const [k, v] of Object.entries(b.unusedElement) as Array<
    [CircuitElement, number]
  >) {
    unusedElement[k] = (unusedElement[k] ?? 0) + (v ?? 0);
  }
  return {
    hp: a.hp + b.hp,
    vit: a.vit + b.vit,
    agi: a.agi + b.agi,
    spr: a.spr + b.spr,
    pDef: a.pDef + b.pDef,
    mDef: a.mDef + b.mDef,
    atkSpeed: a.atkSpeed + b.atkSpeed,
    cooldown: a.cooldown + b.cooldown,
    agiSpr: a.agiSpr + b.agiSpr,
    unusedElement,
    hpPercent: a.hpPercent + b.hpPercent,
    otherworld: a.otherworld + b.otherworld,
    resonanceCharge: a.resonanceCharge + b.resonanceCharge,
    str: a.str + b.str,
    int: a.int + b.int,
  };
}

export function schemeContribution(
  scheme: InsigniaScheme,
  piecesById: Map<string, InsigniaPiece>,
  element: CircuitElement | "all",
): InsigniaContribution {
  return genericSchemeContribution(
    scheme,
    piecesById,
    {
      slotIds: INSIGNIA_SLOT_IDS,
      isSocketValid: (piece, slot) => canSocketIn(piece, slot),
      pieceContribution,
      emptyExtra,
      mergeExtra,
    },
    element,
  );
}

export function equippedCount(scheme: InsigniaScheme): number {
  return countEquipped(scheme, INSIGNIA_SLOT_IDS);
}

export type EquippedInsignia = LoadoutEquipped<InsigniaPiece, InsigniaSlotId>;

export function listEquippedInsignias(
  scheme: InsigniaScheme,
  piecesById: Map<string, InsigniaPiece>,
): EquippedInsignia[] {
  return listEquipped(
    scheme,
    piecesById,
    INSIGNIA_SLOT_IDS,
    (piece, slot) => canSocketIn(piece, slot),
  );
}

export function unequipInsignia(
  scheme: InsigniaScheme,
  insigniaId: string,
): InsigniaScheme {
  return unequipPiece(scheme, INSIGNIA_SLOT_IDS, insigniaId);
}

export type InsigniaSlotGain = LoadoutSlotGain<InsigniaPiece, InsigniaSlotId>;

export type InsigniaSwapGain = LoadoutSwapGain<InsigniaSlotId>;

export type InsigniaComparison =
  LoadoutComparison<InsigniaPiece, InsigniaSlotId>;

export function compareSchemeInsignias(
  scheme: InsigniaScheme,
  pieces: InsigniaPiece[],
  piecesById: Map<string, InsigniaPiece>,
  damageOf: (scheme: InsigniaScheme | null) => number,
): InsigniaComparison {
  return compareLoadout(
    scheme,
    pieces,
    piecesById,
    damageOf,
    {
      slotIds: INSIGNIA_SLOT_IDS,
      isSocketValid: (piece, slot) => canSocketIn(piece, slot),
      slotsForPiece: (piece) => piece.slots.filter(isInsigniaSlotId),
    },
  );
}

export function assignInsigniaToSlot(
  scheme: InsigniaScheme,
  slot: InsigniaSlotId,
  insigniaId: string | null,
): InsigniaScheme {
  return loadoutAssignToSlot(scheme, INSIGNIA_SLOT_IDS, slot, insigniaId);
}

export function detachInsigniasFromSchemes(
  schemes: InsigniaScheme[],
  insigniaIds: string[],
): InsigniaScheme[] {
  return loadoutDetach(schemes, INSIGNIA_SLOT_IDS, insigniaIds);
}

export function normalizeInsigniaPiece(raw: unknown): InsigniaPiece | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const rarity = parseRarity(src.rarity);
  if (!rarity) return null;
  const id = typeof src.id === "string" && src.id ? src.id : makeId("insignia");
  const now = new Date().toISOString();
  const slots = normalizeSlots(src.slots);
  const rank = parseRank(src.rank);
  const affixes = normalizeAffixList(src.affixes);
  return {
    id,
    name: typeof src.name === "string" ? src.name.trim() : "",
    rarity,
    slots,
    rank,
    affixes,
    note: typeof src.note === "string" ? src.note : "",
    createdAt: typeof src.createdAt === "string" ? src.createdAt : now,
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : now,
  };
}

export function normalizeInsigniaScheme(raw: unknown): InsigniaScheme | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const id = typeof src.id === "string" && src.id ? src.id : makeId("ischeme");
  const name =
    typeof src.name === "string" && src.name.trim()
      ? src.name.trim()
      : "徽記方案";
  const now = new Date().toISOString();
  const equipped: InsigniaScheme["equipped"] = {};
  if (src.equipped && typeof src.equipped === "object") {
    for (const [slot, iid] of Object.entries(
      src.equipped as Record<string, unknown>,
    )) {
      if (!isInsigniaSlotId(slot)) continue;
      equipped[slot] = typeof iid === "string" && iid ? iid : null;
    }
  }
  return {
    id,
    name,
    note: typeof src.note === "string" ? src.note : "",
    equipped,
    createdAt: typeof src.createdAt === "string" ? src.createdAt : now,
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : now,
  };
}

function parseRarity(raw: unknown): InsigniaRarity | null {
  if (raw === "epic" || raw === "rare") return raw;
  if (raw === "史詩" || raw === "金") return "epic";
  if (raw === "稀有" || raw === "粉") return "rare";
  return null;
}

function parseRank(raw: unknown): InsigniaRank {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return 3;
}

function normalizeSlots(raw: unknown): InsigniaSlotId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<InsigniaSlotId>();
  const out: InsigniaSlotId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isInsigniaSlotId(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function normalizeAffixList(raw: unknown): InsigniaAffix[] {
  if (!Array.isArray(raw)) return [];
  const out: InsigniaAffix[] = [];
  for (const item of raw) {
    const affix = normalizeAffix(item);
    if (!affix) continue;
    out.push(affix);
    if (out.length >= 6) break;
  }
  return out;
}

function normalizeAffix(raw: unknown): InsigniaAffix | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const stat = src.stat;
  if (typeof stat !== "string" || !(stat in INSIGNIA_STAT_LABEL)) return null;
  const value = typeof src.value === "number" ? src.value : Number(src.value);
  if (!Number.isFinite(value)) return null;
  return { stat: stat as InsigniaStatKey, value };
}

export function contributionLines(
  contrib: InsigniaContribution,
): { damage: string[]; extra: string[] } {
  const damage: string[] = [];
  const extra: string[] = [];
  const bag = contrib.bag;

  const pushBag = (key: keyof StatBag, label: string, percent: boolean) => {
    const v = bag[key];
    if (typeof v !== "number" || !v) return;
    damage.push(
      percent ? `${label} +${trimNum(v * 100)}%` : `${label} +${trimNum(v)}`,
    );
  };

  pushBag("critRate", insigniaStatLabel("critRate"), true);
  pushBag("critDamage", insigniaStatLabel("critDamage"), true);
  pushBag("skillDamage", insigniaStatLabel("skillDamage"), true);
  pushBag("normalAttackDamage", insigniaStatLabel("normalAttack"), true);
  pushBag("damageBoost", insigniaStatLabel("damageBoost"), true);
  pushBag("bossDamage", insigniaStatLabel("bossDamage"), true);
  pushBag("statusDamage", insigniaStatLabel("statusDamage"), true);
  pushBag("elementalPower", insigniaStatLabel("elementalPower"), false);
  pushBag("attackPercent", insigniaStatLabel("attackPercent"), true);
  pushBag("attackPercentMagic", insigniaStatLabel("attackPercentMagic"), true);
  pushBag("allElementDamage", insigniaStatLabel("allElementDamage"), true);
  pushBag("additionalDamage", insigniaStatLabel("additionalDamage"), true);

  const { extra: ex } = contrib;
  if (ex.hp) extra.push(`${insigniaStatLabel("hp")} +${trimNum(ex.hp)}`);
  if (ex.hpPercent) extra.push(`${insigniaStatLabel("hpPercent")} +${trimNum(ex.hpPercent * 100)}%`);
  if (ex.pDef) extra.push(`${insigniaStatLabel("pDef")} +${trimNum(ex.pDef * 100)}%`);
  if (ex.mDef) extra.push(`${insigniaStatLabel("mDef")} +${trimNum(ex.mDef * 100)}%`);
  if (ex.atkSpeed) extra.push(`${insigniaStatLabel("atkSpeed")} +${trimNum(ex.atkSpeed * 100)}%`);
  if (ex.cooldown) extra.push(`${insigniaStatLabel("cooldown")} +${trimNum(ex.cooldown * 100)}%`);
  if (ex.str) extra.push(`${insigniaStatLabel("str")} +${trimNum(ex.str)}`);
  if (ex.int) extra.push(`${insigniaStatLabel("int")} +${trimNum(ex.int)}`);
  if (ex.otherworld) extra.push(`${insigniaStatLabel("otherworld")} +${trimNum(ex.otherworld * 100)}%`);
  if (ex.resonanceCharge) {
    extra.push(`${insigniaStatLabel("resonanceCharge")} +${trimNum(ex.resonanceCharge * 100)}%`);
  }
  for (const [el, v] of Object.entries(ex.unusedElement) as Array<
    [CircuitElement, number]
  >) {
    if (v) extra.push(m().unusedElement(circuitElementLabel(el), trimNum(v)));
  }

  return { damage, extra };
}
