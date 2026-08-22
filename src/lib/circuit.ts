import { makeId } from "./damage";
import {
  circuitElementLabel,
  circuitKindLabel,
  circuitStatLabel,
  m,
} from "./i18n";
import type {
  CircuitAffix,
  CircuitElement,
  CircuitKind,
  CircuitPiece,
  CircuitScheme,
  CircuitSlotId,
  CircuitStatKey,
  DamageType,
  StatBag,
} from "./types";

export const CIRCUIT_KIND_LABEL: Record<CircuitKind, string> = {
  time: "時間",
  nether: "冥燈",
  star: "星軌",
  key: "輝鑰",
};

export const CIRCUIT_ELEMENT_LABEL: Record<CircuitElement | "all", string> = {
  ice: "冰",
  fire: "火",
  electric: "電",
  dark: "暗",
  all: "全部",
};

export const CIRCUIT_STAT_LABEL: Record<CircuitStatKey, string> = {
  str: "力量",
  int: "智力",
  vit: "體質",
  agi: "敏捷",
  spr: "精神",
  hp: "生命值",
  pAtk: "物攻",
  mAtk: "魔攻",
  pDef: "物防",
  mDef: "魔防",
  critRate: "暴率",
  critDamage: "暴傷",
  atkSpeed: "攻速",
  cooldown: "冷卻",
  ice: "冰屬",
  fire: "火屬",
  electric: "電屬",
  dark: "暗屬",
  skillDamage: "技能傷害",
  attack: "攻擊力",
  circuitBoost: "迴路增傷",
  allElementDamage: "全屬性傷害",
  elementalPower: "全屬性強化",
  damageBoost: "傷害提升",
  bossDamage: "頭目傷害",
  statusDamage: "異常傷害",
  strInt: "力量智力",
  agiSpr: "敏捷精神",
};

/** Stats entered/displayed as percentages. */
export const CIRCUIT_PERCENT_STATS = new Set<CircuitStatKey>([
  "str",
  "int",
  "critRate",
  "critDamage",
  "atkSpeed",
  "cooldown",
  "skillDamage",
  "circuitBoost",
  "allElementDamage",
  "damageBoost",
  "bossDamage",
  "statusDamage",
  "strInt",
  "agiSpr",
]);

/** 冰/火/電/暗：以屬強點數計入 (1+屬強/220)。 */
export const CIRCUIT_ELEMENT_STATS = new Set<CircuitStatKey>([
  "ice",
  "fire",
  "electric",
  "dark",
]);

export const CIRCUIT_SUB_STATS: CircuitStatKey[] = [
  "str",
  "int",
  "vit",
  "agi",
  "spr",
  "hp",
  "pAtk",
  "mAtk",
  "pDef",
  "mDef",
  "critRate",
  "critDamage",
  "atkSpeed",
  "cooldown",
  "ice",
  "fire",
  "electric",
  "dark",
];

/** 30 等後解鎖的 4 條突破屬性。 */
export const CIRCUIT_BREAK_STATS: CircuitStatKey[] = [
  "circuitBoost",
  "allElementDamage",
  "elementalPower",
  "skillDamage",
  "damageBoost",
  "bossDamage",
  "statusDamage",
  "critDamage",
  "critRate",
  "cooldown",
  "atkSpeed",
  "strInt",
  "agiSpr",
  "hp",
  "attack",
];

export const CIRCUIT_MAIN_STATS: Record<CircuitKind, CircuitStatKey[]> = {
  time: ["critRate", "critDamage"],
  nether: ["hp"],
  star: ["skillDamage", "ice", "fire", "electric", "dark"],
  key: ["attack"],
};

export const CIRCUIT_SLOT_DEFS: Array<{
  id: CircuitSlotId;
  kind: CircuitKind;
  group: string;
}> = [
  { id: "頭", kind: "time", group: "時間" },
  { id: "手", kind: "time", group: "時間" },
  { id: "腳", kind: "time", group: "時間" },
  { id: "上衣", kind: "nether", group: "冥燈" },
  { id: "褲子", kind: "nether", group: "冥燈" },
  { id: "印章", kind: "star", group: "星軌" },
  { id: "護符", kind: "star", group: "星軌" },
  { id: "武器", kind: "key", group: "輝鑰" },
  { id: "項鍊", kind: "key", group: "輝鑰" },
  { id: "護腕", kind: "key", group: "輝鑰" },
  { id: "戒指", kind: "key", group: "輝鑰" },
];

export const CIRCUIT_SLOT_IDS = CIRCUIT_SLOT_DEFS.map((s) => s.id);

export const CIRCUIT_SLOT_KIND: Record<CircuitSlotId, CircuitKind> =
  Object.fromEntries(CIRCUIT_SLOT_DEFS.map((s) => [s.id, s.kind])) as Record<
    CircuitSlotId,
    CircuitKind
  >;

export function slotsForKind(kind: CircuitKind): CircuitSlotId[] {
  return CIRCUIT_SLOT_DEFS.filter((s) => s.kind === kind).map((s) => s.id);
}

export function defaultMainStat(kind: CircuitKind): CircuitStatKey {
  return CIRCUIT_MAIN_STATS[kind][0]!;
}

export function isValidMainStat(kind: CircuitKind, stat: CircuitStatKey): boolean {
  return CIRCUIT_MAIN_STATS[kind].includes(stat);
}

export function blankCircuitPiece(kind: CircuitKind = "time"): CircuitPiece {
  const now = new Date().toISOString();
  return {
    id: makeId("circuit"),
    name: "",
    kind,
    main: { stat: defaultMainStat(kind), value: 0 },
    subs: [],
    breakthroughs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function blankCircuitScheme(name = m().newScheme): CircuitScheme {
  const now = new Date().toISOString();
  return {
    id: makeId("cscheme"),
    name,
    note: "",
    equipped: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultCircuitName(piece: Pick<CircuitPiece, "kind" | "main">): string {
  return `${circuitKindLabel(piece.kind)} · ${formatAffix(piece.main)}`;
}

export function formatAffix(affix: CircuitAffix): string {
  return `${circuitStatLabel(affix.stat)} ${formatCircuitStatValue(affix.stat, affix.value)}`;
}

export function formatCircuitStatValue(stat: CircuitStatKey, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (CIRCUIT_PERCENT_STATS.has(stat)) {
    const pct = Math.round(value * 10000) / 100;
    return `+${trimNum(pct)}%`;
  }
  return `+${trimNum(value)}`;
}

export function circuitInputValue(stat: CircuitStatKey, stored: number): number {
  if (!Number.isFinite(stored)) return 0;
  if (CIRCUIT_PERCENT_STATS.has(stat)) {
    return Math.round(stored * 10000) / 100;
  }
  return stored;
}

/** Parse a form number: percent stats are entered on a 0–100 scale. */
export function parseCircuitInput(stat: CircuitStatKey, raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (CIRCUIT_PERCENT_STATS.has(stat)) return n / 100;
  return n;
}

function trimNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

export function pieceStatLines(piece: CircuitPiece): string[] {
  const msg = m();
  const lines = [`${msg.affixMain}${formatAffix(piece.main)}`];
  for (const sub of piece.subs) {
    if (!sub.stat || !Number.isFinite(sub.value) || sub.value === 0) continue;
    lines.push(`${msg.affixSub}${formatAffix(sub)}`);
  }
  for (const br of piece.breakthroughs ?? []) {
    if (!br.stat || !Number.isFinite(br.value) || br.value === 0) continue;
    lines.push(`${msg.affixBreak}${formatAffix(br)}`);
  }
  return lines;
}

const ELEMENT_STAT_TO_KEY: Record<CircuitStatKey, CircuitElement | undefined> = {
  str: undefined,
  int: undefined,
  vit: undefined,
  agi: undefined,
  spr: undefined,
  hp: undefined,
  pAtk: undefined,
  mAtk: undefined,
  pDef: undefined,
  mDef: undefined,
  critRate: undefined,
  critDamage: undefined,
  atkSpeed: undefined,
  cooldown: undefined,
  ice: "ice",
  fire: "fire",
  electric: "electric",
  dark: "dark",
  skillDamage: undefined,
  attack: undefined,
  circuitBoost: undefined,
  allElementDamage: undefined,
  elementalPower: undefined,
  damageBoost: undefined,
  bossDamage: undefined,
  statusDamage: undefined,
  strInt: undefined,
  agiSpr: undefined,
};

export type CircuitExtraStats = {
  hp: number;
  vit: number;
  agi: number;
  spr: number;
  pDef: number;
  mDef: number;
  atkSpeed: number;
  cooldown: number;
  agiSpr: number;
  unusedElement: Partial<Record<CircuitElement, number>>;
};

export type CircuitContribution = {
  bag: StatBag;
  extra: CircuitExtraStats;
};

function emptyExtra(): CircuitExtraStats {
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
  };
}

function addToBag(bag: StatBag, key: keyof StatBag, value: number): void {
  if (!value) return;
  const prev = (bag[key] as number | undefined) ?? 0;
  (bag as Record<string, number>)[key] = prev + value;
}

/**
 * Map one affix onto the damage StatBag (or extra, non-damage totals).
 *
 * Damage mappings:
 *   暴率 / 暴傷 / 技傷 / 攻擊力（同時加物攻與魔攻基礎）
 *   物攻 / 魔攻（基礎值，非百分比） / 力量 / 智力 / 力量智力
 *   迴路增傷 / 全屬性傷害 / 全屬性強化 / 提傷 / 頭目 / 異常
 *   冰火電暗 → 屬強（僅當與配置技能屬性相同，或屬性為「全部」）
 *
 * Not in the current formula (recorded in `extra` only):
 *   生命、體質、敏捷、精神、敏捷精神、物防、魔防、攻速、冷卻、未匹配屬性
 */
export function applyCircuitAffix(
  affix: CircuitAffix,
  bag: StatBag,
  extra: CircuitExtraStats,
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
    case "circuitBoost":
      addToBag(bag, "circuitBoost", value);
      return;
    case "allElementDamage":
      addToBag(bag, "allElementDamage", value);
      return;
    case "elementalPower":
      addToBag(bag, "elementalPower", value);
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
    case "strInt":
      addToBag(bag, "strPercent", value);
      addToBag(bag, "intPercent", value);
      return;
    case "agiSpr":
      extra.agiSpr += value;
      return;
    case "attack":
      // 攻擊力同時增加物攻與魔攻基礎值。
      addToBag(bag, "attack", value);
      return;
    case "pAtk":
      addToBag(bag, "physicalAttack", value);
      return;
    case "mAtk":
      addToBag(bag, "magicAttack", value);
      return;
    case "str":
      addToBag(bag, "strPercent", value);
      return;
    case "int":
      addToBag(bag, "intPercent", value);
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
    case "vit":
      extra.vit += value;
      return;
    case "agi":
      extra.agi += value;
      return;
    case "spr":
      extra.spr += value;
      return;
    case "pDef":
      extra.pDef += value;
      return;
    case "mDef":
      extra.mDef += value;
      return;
    default:
      return;
  }
}

export function pieceContribution(
  piece: CircuitPiece,
  element: CircuitElement | "all",
): CircuitContribution {
  const bag: StatBag = {};
  const extra = emptyExtra();
  applyCircuitAffix(piece.main, bag, extra, element);
  for (const sub of piece.subs) applyCircuitAffix(sub, bag, extra, element);
  for (const br of piece.breakthroughs ?? []) {
    applyCircuitAffix(br, bag, extra, element);
  }
  return { bag, extra };
}

export function mergeExtra(a: CircuitExtraStats, b: CircuitExtraStats): CircuitExtraStats {
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
  };
}

export function schemeContribution(
  scheme: CircuitScheme,
  piecesById: Map<string, CircuitPiece>,
  element: CircuitElement | "all",
  _damageType?: DamageType,
): CircuitContribution {
  const bag: StatBag = {};
  let extra = emptyExtra();
  const seen = new Set<string>();

  for (const slot of CIRCUIT_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    if (piece.kind !== CIRCUIT_SLOT_KIND[slot]) continue;
    seen.add(id);
    const part = pieceContribution(piece, element);
    extra = mergeExtra(extra, part.extra);
    for (const [k, v] of Object.entries(part.bag) as Array<[keyof StatBag, number]>) {
      addToBag(bag, k, v);
    }
  }

  return { bag, extra };
}

export function equippedCount(scheme: CircuitScheme): number {
  let n = 0;
  for (const slot of CIRCUIT_SLOT_IDS) {
    if (scheme.equipped[slot]) n += 1;
  }
  return n;
}

export type EquippedCircuit = {
  slot: CircuitSlotId;
  piece: CircuitPiece;
};

export function listEquippedCircuits(
  scheme: CircuitScheme,
  piecesById: Map<string, CircuitPiece>,
): EquippedCircuit[] {
  const seen = new Set<string>();
  const out: EquippedCircuit[] = [];
  for (const slot of CIRCUIT_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    if (piece.kind !== CIRCUIT_SLOT_KIND[slot]) continue;
    seen.add(id);
    out.push({ slot, piece });
  }
  return out;
}

export function unequipCircuit(
  scheme: CircuitScheme,
  circuitId: string,
): CircuitScheme {
  const equipped: CircuitScheme["equipped"] = { ...scheme.equipped };
  let changed = false;
  for (const slot of CIRCUIT_SLOT_IDS) {
    if (equipped[slot] === circuitId) {
      equipped[slot] = null;
      changed = true;
    }
  }
  return changed
    ? { ...scheme, equipped, updatedAt: new Date().toISOString() }
    : scheme;
}

export type CircuitSlotGain = {
  slot: CircuitSlotId;
  piece: CircuitPiece;
  withoutDamage: number;
  /** Full loadout − without this piece. */
  delta: number;
  ratio: number;
  /** Share of (full − none). Multiplicative, so shares need not sum to 1. */
  shareOfTotal: number;
  /** Damage with only this piece equipped. */
  soloDamage: number;
  soloDelta: number;
  soloRatio: number;
};

export type CircuitSwapGain = {
  pieceId: string;
  slot: CircuitSlotId;
  action: "add" | "swap" | "keep";
  replacedId: string | null;
  newDamage: number;
  delta: number;
  ratio: number;
};

export type CircuitComparison = {
  fullDamage: number;
  noneDamage: number;
  totalDelta: number;
  totalRatio: number;
  equipped: CircuitSlotGain[];
  byPieceId: Map<string, CircuitSwapGain>;
};

/**
 * Per-circuit damage vs the current scheme: leave-one-out, solo, and
 * best add/swap placement for every piece in the library.
 */
export function compareSchemeCircuits(
  scheme: CircuitScheme,
  pieces: CircuitPiece[],
  piecesById: Map<string, CircuitPiece>,
  damageOf: (scheme: CircuitScheme | null) => number,
): CircuitComparison {
  const fullDamage = damageOf(scheme);
  const noneDamage = damageOf(null);
  const totalDelta = fullDamage - noneDamage;
  const totalRatio = noneDamage > 0 ? fullDamage / noneDamage - 1 : 0;
  const equippedRefs = listEquippedCircuits(scheme, piecesById);
  const soloCache = new Map<string, number>();

  const equipped: CircuitSlotGain[] = equippedRefs.map(({ slot, piece }) => {
    const withoutDamage = damageOf(unequipCircuit(scheme, piece.id));
    const delta = fullDamage - withoutDamage;
    let soloDamage = soloCache.get(piece.id);
    if (soloDamage === undefined) {
      const soloScheme: CircuitScheme = {
        ...scheme,
        equipped: { [slot]: piece.id },
      };
      soloDamage = damageOf(soloScheme);
      soloCache.set(piece.id, soloDamage);
    }
    return {
      slot,
      piece,
      withoutDamage,
      delta,
      ratio: withoutDamage > 0 ? fullDamage / withoutDamage - 1 : 0,
      shareOfTotal: totalDelta !== 0 ? delta / totalDelta : 0,
      soloDamage,
      soloDelta: soloDamage - noneDamage,
      soloRatio: noneDamage > 0 ? soloDamage / noneDamage - 1 : 0,
    };
  });

  equipped.sort((a, b) => b.delta - a.delta || b.soloDelta - a.soloDelta);

  const byPieceId = new Map<string, CircuitSwapGain>();
  for (const piece of pieces) {
    const slots = slotsForKind(piece.kind);
    if (slots.length === 0) continue;
    let best: CircuitSwapGain | null = null;
    for (const slot of slots) {
      const occupantId = scheme.equipped[slot] ?? null;
      const next = assignCircuitToSlot(scheme, slot, piece.id);
      const newDamage = damageOf(next);
      const action: CircuitSwapGain["action"] =
        occupantId === piece.id ? "keep" : occupantId ? "swap" : "add";
      const candidate: CircuitSwapGain = {
        pieceId: piece.id,
        slot,
        action,
        replacedId: action === "swap" ? occupantId : null,
        newDamage,
        delta: newDamage - fullDamage,
        ratio: fullDamage > 0 ? newDamage / fullDamage - 1 : 0,
      };
      if (
        !best ||
        candidate.newDamage > best.newDamage ||
        (candidate.newDamage === best.newDamage && candidate.action === "keep")
      ) {
        best = candidate;
      }
    }
    if (best) byPieceId.set(piece.id, best);
  }

  return {
    fullDamage,
    noneDamage,
    totalDelta,
    totalRatio,
    equipped,
    byPieceId,
  };
}

/** Unequip a piece from every slot, then put it on `slot`. */
export function assignCircuitToSlot(
  scheme: CircuitScheme,
  slot: CircuitSlotId,
  circuitId: string | null,
): CircuitScheme {
  const equipped: CircuitScheme["equipped"] = { ...scheme.equipped };
  if (circuitId) {
    for (const s of CIRCUIT_SLOT_IDS) {
      if (equipped[s] === circuitId) equipped[s] = null;
    }
    equipped[slot] = circuitId;
  } else {
    equipped[slot] = null;
  }
  return {
    ...scheme,
    equipped,
    updatedAt: new Date().toISOString(),
  };
}

export function detachCircuitsFromSchemes(
  schemes: CircuitScheme[],
  circuitIds: string[],
): CircuitScheme[] {
  const idSet = new Set(circuitIds);
  return schemes.map((scheme) => {
    let changed = false;
    const equipped: CircuitScheme["equipped"] = { ...scheme.equipped };
    for (const slot of CIRCUIT_SLOT_IDS) {
      const id = equipped[slot];
      if (id && idSet.has(id)) {
        equipped[slot] = null;
        changed = true;
      }
    }
    return changed
      ? { ...scheme, equipped, updatedAt: new Date().toISOString() }
      : scheme;
  });
}

export function normalizeCircuitPiece(raw: unknown): CircuitPiece | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const kind = parseKind(src.kind);
  if (!kind) return null;
  const id = typeof src.id === "string" && src.id ? src.id : makeId("circuit");
  const now = new Date().toISOString();
  const main = normalizeAffix(src.main);
  const mainStat =
    main && isValidMainStat(kind, main.stat) ? main : { stat: defaultMainStat(kind), value: 0 };
  const subs = normalizeAffixList(src.subs, CIRCUIT_SUB_STATS);
  const breakthroughs = normalizeAffixList(
    src.breakthroughs ?? src.breaks,
    CIRCUIT_BREAK_STATS,
    { allowDuplicates: true },
  );
  return {
    id,
    name: typeof src.name === "string" ? src.name.trim() : "",
    kind,
    main: mainStat,
    subs,
    breakthroughs,
    createdAt: typeof src.createdAt === "string" ? src.createdAt : now,
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : now,
  };
}

function normalizeAffixList(
  raw: unknown,
  allowed: CircuitStatKey[],
  opts?: { allowDuplicates?: boolean },
): CircuitAffix[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<CircuitStatKey>();
  const out: CircuitAffix[] = [];
  for (const item of raw) {
    const affix = normalizeAffix(item);
    if (!affix) continue;
    if (!allowed.includes(affix.stat)) continue;
    if (!opts?.allowDuplicates) {
      if (seen.has(affix.stat)) continue;
      seen.add(affix.stat);
    }
    out.push(affix);
    if (out.length >= 4) break;
  }
  return out;
}

export function normalizeCircuitScheme(raw: unknown): CircuitScheme | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const id = typeof src.id === "string" && src.id ? src.id : makeId("cscheme");
  const name =
    typeof src.name === "string" && src.name.trim() ? src.name.trim() : "迴路方案";
  const now = new Date().toISOString();
  const equipped: CircuitScheme["equipped"] = {};
  if (src.equipped && typeof src.equipped === "object") {
    for (const [slot, cid] of Object.entries(
      src.equipped as Record<string, unknown>,
    )) {
      if (!isCircuitSlotId(slot)) continue;
      equipped[slot] = typeof cid === "string" && cid ? cid : null;
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

function parseKind(raw: unknown): CircuitKind | null {
  if (raw === "time" || raw === "nether" || raw === "star" || raw === "key") {
    return raw;
  }
  if (raw === "時間") return "time";
  if (raw === "冥燈") return "nether";
  if (raw === "星軌") return "star";
  if (raw === "輝鑰") return "key";
  return null;
}

function isCircuitSlotId(value: string): value is CircuitSlotId {
  return (CIRCUIT_SLOT_IDS as string[]).includes(value);
}

function normalizeAffix(raw: unknown): CircuitAffix | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const stat = src.stat;
  if (typeof stat !== "string" || !(stat in CIRCUIT_STAT_LABEL)) return null;
  const value = typeof src.value === "number" ? src.value : Number(src.value);
  if (!Number.isFinite(value)) return null;
  return { stat: stat as CircuitStatKey, value };
}

export function contributionLines(
  contrib: CircuitContribution,
): { damage: string[]; extra: string[] } {
  const damage: string[] = [];
  const extra: string[] = [];
  const bag = contrib.bag;

  const pushBag = (key: keyof StatBag, label: string, percent: boolean) => {
    const v = bag[key];
    if (typeof v !== "number" || !v) return;
    damage.push(percent ? `${label} +${trimNum(v * 100)}%` : `${label} +${trimNum(v)}`);
  };

  pushBag("attack", circuitStatLabel("attack"), false);
  pushBag("physicalAttack", circuitStatLabel("pAtk"), false);
  pushBag("magicAttack", circuitStatLabel("mAtk"), false);
  pushBag("critRate", circuitStatLabel("critRate"), true);
  pushBag("critDamage", circuitStatLabel("critDamage"), true);
  pushBag("skillDamage", circuitStatLabel("skillDamage"), true);
  pushBag("circuitBoost", circuitStatLabel("circuitBoost"), true);
  pushBag("allElementDamage", circuitStatLabel("allElementDamage"), true);
  pushBag("elementalPower", circuitStatLabel("elementalPower"), false);
  pushBag("damageBoost", circuitStatLabel("damageBoost"), true);
  pushBag("bossDamage", circuitStatLabel("bossDamage"), true);
  pushBag("statusDamage", circuitStatLabel("statusDamage"), true);
  pushBag("strPercent", circuitStatLabel("str"), true);
  pushBag("intPercent", circuitStatLabel("int"), true);

  const { extra: ex } = contrib;
  if (ex.hp) extra.push(`${circuitStatLabel("hp")} +${trimNum(ex.hp)}`);
  if (ex.vit) extra.push(`${circuitStatLabel("vit")} +${trimNum(ex.vit)}`);
  if (ex.agi) extra.push(`${circuitStatLabel("agi")} +${trimNum(ex.agi)}`);
  if (ex.spr) extra.push(`${circuitStatLabel("spr")} +${trimNum(ex.spr)}`);
  if (ex.agiSpr) extra.push(`${circuitStatLabel("agiSpr")} +${trimNum(ex.agiSpr * 100)}%`);
  if (ex.pDef) extra.push(`${circuitStatLabel("pDef")} +${trimNum(ex.pDef)}`);
  if (ex.mDef) extra.push(`${circuitStatLabel("mDef")} +${trimNum(ex.mDef)}`);
  if (ex.atkSpeed) extra.push(`${circuitStatLabel("atkSpeed")} +${trimNum(ex.atkSpeed * 100)}%`);
  if (ex.cooldown) extra.push(`${circuitStatLabel("cooldown")} +${trimNum(ex.cooldown * 100)}%`);
  for (const [el, v] of Object.entries(ex.unusedElement) as Array<
    [CircuitElement, number]
  >) {
    if (v) extra.push(m().unusedElement(circuitElementLabel(el), trimNum(v)));
  }

  return { damage, extra };
}
