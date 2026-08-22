import type {
  CatalogItem,
  CircuitElement,
  CircuitPiece,
  CircuitScheme,
  CombatStats,
  DamageType,
  Equipment,
  InsigniaPiece,
  InsigniaScheme,
  ProfessionId,
  Profile,
  StatBag,
} from "./types";
import { parseObservedDamage } from "./compare";
import { emptyStats, makeId } from "./damage";
import { isProfessionId } from "./profession";
import { normalizeCircuitPiece, normalizeCircuitScheme } from "./circuit";
import {
  normalizeInsigniaPiece,
  normalizeInsigniaScheme,
} from "./insignia";

export const SHARE_HASH_PREFIX = "s=";

/** Full profile + referenced gear/items/circuits/insignias. */
export type SharePayloadFull = {
  v: 1;
  kind?: "full";
  profile: Profile;
  equipment: Equipment[];
  items: CatalogItem[];
  circuits?: CircuitPiece[];
  circuitSchemes?: CircuitScheme[];
  insignias?: InsigniaPiece[];
  insigniaSchemes?: InsigniaScheme[];
};

/**
 * Compact share: name + damage type + numeric combat stats only.
 * No equipment / item / buff catalog data.
 */
export type SharePayloadStats = {
  v: 2;
  kind: "stats";
  name: string;
  note?: string;
  damageType: DamageType;
  stats: CombatStats;
};

export type StatsShareEntry = {
  name: string;
  note?: string;
  damageType: DamageType;
  stats: CombatStats;
};

/** Multiple profiles, stats only. */
export type SharePayloadMultiStats = {
  v: 3;
  kind: "multi-stats";
  profiles: StatsShareEntry[];
};

/** Multiple profiles + union of referenced gear/items/circuits. */
export type SharePayloadMultiFull = {
  v: 3;
  kind: "multi-full";
  profiles: Profile[];
  equipment: Equipment[];
  items: CatalogItem[];
  circuits?: CircuitPiece[];
  circuitSchemes?: CircuitScheme[];
  insignias?: InsigniaPiece[];
  insigniaSchemes?: InsigniaScheme[];
};

export type SharePayload =
  | SharePayloadFull
  | SharePayloadStats
  | SharePayloadMultiStats
  | SharePayloadMultiFull;

export type ShareImportResult = {
  /** Newly created profiles to append to local storage. */
  profiles: Profile[];
  /**
   * Share targets in payload order — either an existing local profile
   * (deduped) or a newly created one from `profiles`.
   */
  resolvedProfiles: Profile[];
  /** How many share profiles matched something already stored. */
  skippedDuplicates: number;
  equipmentToAdd: Equipment[];
  itemsToAdd: CatalogItem[];
  circuitsToAdd: CircuitPiece[];
  schemesToAdd: CircuitScheme[];
  insigniasToAdd: InsigniaPiece[];
  insigniaSchemesToAdd: InsigniaScheme[];
  unhideEquipmentIds: string[];
  unhideItemIds: string[];
};

const BASE_STAT_KEYS: Array<keyof CombatStats> = [
  "attack",
  "defenseBreak",
  "critRate",
  "critDamage",
  "elementalPower",
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
  "skillMultiplier",
  "attackPercent",
  "physicalAttack",
  "magicAttack",
  "normalAttackDamage",
];

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("no CompressionStream");
  }
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("no DecompressionStream");
  }
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatBag(raw: unknown): StatBag {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: StatBag = {};
  for (const [k, v] of Object.entries(src)) {
    const n = asFiniteNumber(v, NaN);
    if (Number.isFinite(n)) (out as Record<string, number>)[k] = n;
  }
  return out;
}

function normalizeCombatStats(raw: unknown): CombatStats {
  const base = emptyStats();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Record<string, unknown>;
  for (const key of BASE_STAT_KEYS) {
    if (key in src) {
      base[key] = asFiniteNumber(src[key], base[key] ?? 0) as never;
    }
  }
  if (!Number.isFinite(base.skillMultiplier) || base.skillMultiplier === 0) {
    base.skillMultiplier = 1;
  }
  return base;
}

/** Compact numeric bag for the URL (omit zeros / defaults where safe). */
export function compactStats(stats: CombatStats): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of BASE_STAT_KEYS) {
    const value = stats[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (key === "skillMultiplier") {
      out[key] = value;
      continue;
    }
    if (value === 0) continue;
    out[key] = value;
  }
  if (out.skillMultiplier === undefined) out.skillMultiplier = 1;
  return out;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

function normalizeEquipment(raw: unknown): Equipment | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const id = typeof src.id === "string" && src.id ? src.id : null;
  const name = typeof src.name === "string" ? src.name.trim() : "";
  const slot = typeof src.slot === "string" ? src.slot.trim() : "";
  if (!id || !name || !slot) return null;
  return {
    id,
    name,
    slot,
    set: typeof src.set === "string" ? src.set : undefined,
    stats: normalizeStatBag(src.stats),
    statLines: normalizeStringArray(src.statLines),
    effects: normalizeStringArray(src.effects),
    source: typeof src.source === "string" ? src.source : "shared",
    demo: false,
  };
}

function normalizeItem(raw: unknown): CatalogItem | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const id = typeof src.id === "string" && src.id ? src.id : null;
  const name = typeof src.name === "string" ? src.name.trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    kind: "item",
    stats: normalizeStatBag(src.stats),
    statLines: normalizeStringArray(src.statLines),
    demo: false,
  };
}

function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const name =
    typeof src.name === "string" && src.name.trim()
      ? src.name.trim()
      : "分享配置";
  const damageType = src.damageType === "physical" ? "physical" : "magic";
  const now = new Date().toISOString();

  const equipped: Record<string, string | null> = {};
  if (src.equipped && typeof src.equipped === "object") {
    for (const [slot, eqId] of Object.entries(
      src.equipped as Record<string, unknown>,
    )) {
      if (!slot) continue;
      equipped[slot] = typeof eqId === "string" && eqId ? eqId : null;
    }
  }

  const itemIds = Array.isArray(src.itemIds)
    ? src.itemIds.filter((x): x is string => typeof x === "string" && !!x)
    : [];

  const element = parseProfileElement(src.element);

  return {
    id: typeof src.id === "string" && src.id ? src.id : makeId("profile"),
    name,
    note: typeof src.note === "string" ? src.note : "",
    damageType,
    element,
    base: normalizeCombatStats(src.base),
    equipped,
    itemIds,
    circuitSchemeId:
      typeof src.circuitSchemeId === "string" && src.circuitSchemeId
        ? src.circuitSchemeId
        : null,
    insigniaSchemeId:
      typeof src.insigniaSchemeId === "string" && src.insigniaSchemeId
        ? src.insigniaSchemeId
        : null,
    professionId: parseProfessionId(src.professionId),
    observedTrainingDamage: parseObservedDamage(src.observedTrainingDamage),
    createdAt: typeof src.createdAt === "string" ? src.createdAt : now,
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : now,
  };
}

function parseProfileElement(raw: unknown): CircuitElement | "all" {
  if (raw === "ice" || raw === "fire" || raw === "electric" || raw === "dark") {
    return raw;
  }
  return "all";
}

function parseProfessionId(raw: unknown): ProfessionId | null {
  return isProfessionId(raw) ? raw : null;
}

function normalizeStatsEntry(raw: unknown): StatsShareEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const name =
    typeof src.name === "string" && src.name.trim()
      ? src.name.trim()
      : "分享配置";
  return {
    name,
    note: typeof src.note === "string" ? src.note : undefined,
    damageType: src.damageType === "physical" ? "physical" : "magic",
    stats: normalizeCombatStats(src.stats ?? src.base),
  };
}

export function parseSharePayload(data: unknown): SharePayload | null {
  if (!data || typeof data !== "object") return null;
  const src = data as Record<string, unknown>;

  // v3 multi-stats
  if (src.v === 3 && src.kind === "multi-stats") {
    const list = Array.isArray(src.profiles) ? src.profiles : [];
    const profiles = list
      .map(normalizeStatsEntry)
      .filter((x): x is StatsShareEntry => x !== null);
    if (profiles.length === 0) return null;
    return { v: 3, kind: "multi-stats", profiles };
  }

  // v3 multi-full
  if (src.v === 3 && (src.kind === "multi-full" || src.kind === "multi")) {
    const list = Array.isArray(src.profiles) ? src.profiles : [];
    const profiles = list
      .map(normalizeProfile)
      .filter((x): x is Profile => x !== null);
    if (profiles.length === 0) return null;
    const equipment = Array.isArray(src.equipment)
      ? src.equipment
          .map(normalizeEquipment)
          .filter((x): x is Equipment => x !== null)
      : [];
    const items = Array.isArray(src.items)
      ? src.items.map(normalizeItem).filter((x): x is CatalogItem => x !== null)
      : [];
    const circuits = Array.isArray(src.circuits)
      ? src.circuits
          .map(normalizeCircuitPiece)
          .filter((x): x is CircuitPiece => x !== null)
      : [];
    const circuitSchemes = Array.isArray(src.circuitSchemes)
      ? src.circuitSchemes
          .map(normalizeCircuitScheme)
          .filter((x): x is CircuitScheme => x !== null)
      : [];
    const insignias = Array.isArray(src.insignias)
      ? src.insignias
          .map(normalizeInsigniaPiece)
          .filter((x): x is InsigniaPiece => x !== null)
      : [];
    const insigniaSchemes = Array.isArray(src.insigniaSchemes)
      ? src.insigniaSchemes
          .map(normalizeInsigniaScheme)
          .filter((x): x is InsigniaScheme => x !== null)
      : [];
    return {
      v: 3,
      kind: "multi-full",
      profiles,
      equipment,
      items,
      circuits,
      circuitSchemes,
      insignias,
      insigniaSchemes,
    };
  }

  // v2 — stats-only compact payload
  if (src.v === 2 || src.kind === "stats") {
    const name =
      typeof src.name === "string" && src.name.trim()
        ? src.name.trim()
        : "分享配置";
    const damageType = src.damageType === "physical" ? "physical" : "magic";
    const stats = normalizeCombatStats(src.stats ?? src.base);
    return {
      v: 2,
      kind: "stats",
      name,
      note: typeof src.note === "string" ? src.note : undefined,
      damageType,
      stats,
    };
  }

  // v1 — full profile (+ optional catalog)
  if (src.v !== 1) return null;
  const profile = normalizeProfile(src.profile);
  if (!profile) return null;
  const equipment = Array.isArray(src.equipment)
    ? src.equipment
        .map(normalizeEquipment)
        .filter((x): x is Equipment => x !== null)
    : [];
  const items = Array.isArray(src.items)
    ? src.items.map(normalizeItem).filter((x): x is CatalogItem => x !== null)
    : [];
  const circuits = Array.isArray(src.circuits)
    ? src.circuits
        .map(normalizeCircuitPiece)
        .filter((x): x is CircuitPiece => x !== null)
    : [];
  const circuitSchemes = Array.isArray(src.circuitSchemes)
    ? src.circuitSchemes
        .map(normalizeCircuitScheme)
        .filter((x): x is CircuitScheme => x !== null)
    : [];
  const insignias = Array.isArray(src.insignias)
    ? src.insignias
        .map(normalizeInsigniaPiece)
        .filter((x): x is InsigniaPiece => x !== null)
    : [];
  const insigniaSchemes = Array.isArray(src.insigniaSchemes)
    ? src.insigniaSchemes
        .map(normalizeInsigniaScheme)
        .filter((x): x is InsigniaScheme => x !== null)
    : [];
  return {
    v: 1,
    kind: "full",
    profile,
    equipment,
    items,
    circuits,
    circuitSchemes,
    insignias,
    insigniaSchemes,
  };
}

/** Snapshot of a single profile (no other profiles, no full catalog). */
function slimProfile(profile: Profile): Profile {
  const equipped: Record<string, string | null> = {};
  for (const [slot, eqId] of Object.entries(profile.equipped)) {
    if (eqId) equipped[slot] = eqId;
  }
  return {
    id: profile.id,
    name: profile.name,
    note: profile.note,
    damageType: profile.damageType,
    element: profile.element ?? "all",
    base: normalizeCombatStats(profile.base),
    equipped,
    itemIds: [...profile.itemIds],
    circuitSchemeId: profile.circuitSchemeId ?? null,
    insigniaSchemeId: profile.insigniaSchemeId ?? null,
    professionId: profile.professionId ?? null,
    observedTrainingDamage: parseObservedDamage(profile.observedTrainingDamage),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function collectReferencedCatalog(
  profiles: Profile[],
  equipmentById: Map<string, Equipment>,
  itemsById: Map<string, CatalogItem>,
  circuitsById: Map<string, CircuitPiece> = new Map(),
  schemesById: Map<string, CircuitScheme> = new Map(),
  insigniasById: Map<string, InsigniaPiece> = new Map(),
  insigniaSchemesById: Map<string, InsigniaScheme> = new Map(),
): {
  equipment: Equipment[];
  items: CatalogItem[];
  circuits: CircuitPiece[];
  circuitSchemes: CircuitScheme[];
  insignias: InsigniaPiece[];
  insigniaSchemes: InsigniaScheme[];
} {
  const equipment: Equipment[] = [];
  const seenEq = new Set<string>();
  const items: CatalogItem[] = [];
  const seenItem = new Set<string>();
  const circuits: CircuitPiece[] = [];
  const seenCircuit = new Set<string>();
  const circuitSchemes: CircuitScheme[] = [];
  const seenScheme = new Set<string>();
  const insignias: InsigniaPiece[] = [];
  const seenInsignia = new Set<string>();
  const insigniaSchemes: InsigniaScheme[] = [];
  const seenInsigniaScheme = new Set<string>();

  for (const profile of profiles) {
    for (const eqId of Object.values(profile.equipped)) {
      if (!eqId || seenEq.has(eqId)) continue;
      seenEq.add(eqId);
      const eq = equipmentById.get(eqId);
      if (!eq) continue;
      equipment.push({
        id: eq.id,
        name: eq.name,
        slot: eq.slot,
        set: eq.set,
        stats: { ...eq.stats },
        statLines: [...(eq.statLines ?? [])],
        effects: [...(eq.effects ?? [])],
        source: eq.source ?? (eq.demo ? "demo" : "custom"),
        demo: false,
      });
    }
    for (const itemId of profile.itemIds) {
      if (!itemId || seenItem.has(itemId)) continue;
      seenItem.add(itemId);
      const item = itemsById.get(itemId);
      if (!item) continue;
      items.push({
        id: item.id,
        name: item.name,
        kind: "item",
        stats: { ...item.stats },
        statLines: [...(item.statLines ?? [])],
        demo: false,
      });
    }

    const schemeId = profile.circuitSchemeId;
    if (schemeId && !seenScheme.has(schemeId)) {
      const scheme = schemesById.get(schemeId);
      if (scheme) {
        seenScheme.add(schemeId);
        circuitSchemes.push({
          id: scheme.id,
          name: scheme.name,
          note: scheme.note,
          equipped: { ...scheme.equipped },
          createdAt: scheme.createdAt,
          updatedAt: scheme.updatedAt,
        });
        for (const cid of Object.values(scheme.equipped)) {
          if (!cid || seenCircuit.has(cid)) continue;
          seenCircuit.add(cid);
          const piece = circuitsById.get(cid);
          if (!piece) continue;
          circuits.push({
            id: piece.id,
            name: piece.name,
            kind: piece.kind,
            main: { ...piece.main },
            subs: piece.subs.map((s) => ({ ...s })),
            breakthroughs: (piece.breakthroughs ?? []).map((s) => ({ ...s })),
            createdAt: piece.createdAt,
            updatedAt: piece.updatedAt,
          });
        }
      }
    }

    const insigniaSchemeId = profile.insigniaSchemeId;
    if (insigniaSchemeId && !seenInsigniaScheme.has(insigniaSchemeId)) {
      const scheme = insigniaSchemesById.get(insigniaSchemeId);
      if (scheme) {
        seenInsigniaScheme.add(insigniaSchemeId);
        insigniaSchemes.push({
          id: scheme.id,
          name: scheme.name,
          note: scheme.note,
          equipped: { ...scheme.equipped },
          createdAt: scheme.createdAt,
          updatedAt: scheme.updatedAt,
        });
        for (const iid of Object.values(scheme.equipped)) {
          if (!iid || seenInsignia.has(iid)) continue;
          seenInsignia.add(iid);
          const piece = insigniasById.get(iid);
          if (!piece) continue;
          insignias.push({
            id: piece.id,
            name: piece.name,
            rarity: piece.rarity,
            slots: [...piece.slots],
            rank: piece.rank,
            affixes: piece.affixes.map((a) => ({ ...a })),
            note: piece.note,
            createdAt: piece.createdAt,
            updatedAt: piece.updatedAt,
          });
        }
      }
    }
  }
  return { equipment, items, circuits, circuitSchemes, insignias, insigniaSchemes };
}

/**
 * Full share for one or more profiles + only their referenced gear/items.
 */
export function buildSharePayload(
  profiles: Profile | Profile[],
  equipmentById: Map<string, Equipment>,
  itemsById: Map<string, CatalogItem>,
  circuitsById: Map<string, CircuitPiece> = new Map(),
  schemesById: Map<string, CircuitScheme> = new Map(),
  insigniasById: Map<string, InsigniaPiece> = new Map(),
  insigniaSchemesById: Map<string, InsigniaScheme> = new Map(),
): SharePayloadFull | SharePayloadMultiFull {
  const list = (Array.isArray(profiles) ? profiles : [profiles]).map(slimProfile);
  if (list.length === 0) {
    throw new Error("no profiles to share");
  }
  const {
    equipment,
    items,
    circuits,
    circuitSchemes,
    insignias,
    insigniaSchemes,
  } = collectReferencedCatalog(
    list,
    equipmentById,
    itemsById,
    circuitsById,
    schemesById,
    insigniasById,
    insigniaSchemesById,
  );

  if (list.length === 1) {
    return {
      v: 1,
      kind: "full",
      profile: list[0]!,
      equipment,
      items,
      circuits,
      circuitSchemes,
      insignias,
      insigniaSchemes,
    };
  }

  return {
    v: 3,
    kind: "multi-full",
    profiles: list,
    equipment,
    items,
    circuits,
    circuitSchemes,
    insignias,
    insigniaSchemes,
  };
}

/**
 * Stats-only share for one or more profiles.
 * Pass effective stats already resolved (gear/buffs baked in).
 */
export function buildNumericSharePayload(
  entries:
    | { profile: Profile; stats: CombatStats }
    | Array<{ profile: Profile; stats: CombatStats }>,
): SharePayloadStats | SharePayloadMultiStats {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) throw new Error("no profiles to share");

  if (list.length === 1) {
    const { profile, stats } = list[0]!;
    return {
      v: 2,
      kind: "stats",
      name: profile.name,
      note: profile.note || undefined,
      damageType: profile.damageType,
      stats: normalizeCombatStats(stats),
    };
  }

  return {
    v: 3,
    kind: "multi-stats",
    profiles: list.map(({ profile, stats }) => ({
      name: profile.name,
      note: profile.note || undefined,
      damageType: profile.damageType,
      stats: normalizeCombatStats(stats),
    })),
  };
}

function isStatsPayload(payload: SharePayload): payload is SharePayloadStats {
  return payload.v === 2 && payload.kind === "stats";
}

function isMultiStatsPayload(
  payload: SharePayload,
): payload is SharePayloadMultiStats {
  return payload.v === 3 && payload.kind === "multi-stats";
}

function isMultiFullPayload(
  payload: SharePayload,
): payload is SharePayloadMultiFull {
  return payload.v === 3 && payload.kind === "multi-full";
}

/** Serialize payload for the hash (stats payloads stay tiny; omit zero stats). */
function serializePayload(payload: SharePayload): string {
  if (isStatsPayload(payload)) {
    return JSON.stringify({
      v: 2,
      kind: "stats",
      name: payload.name,
      ...(payload.note ? { note: payload.note } : {}),
      damageType: payload.damageType,
      stats: compactStats(payload.stats),
    });
  }
  if (isMultiStatsPayload(payload)) {
    return JSON.stringify({
      v: 3,
      kind: "multi-stats",
      profiles: payload.profiles.map((p) => ({
        name: p.name,
        ...(p.note ? { note: p.note } : {}),
        damageType: p.damageType,
        stats: compactStats(p.stats),
      })),
    });
  }
  if (isMultiFullPayload(payload)) {
    return JSON.stringify({
      v: 3,
      kind: "multi-full",
      profiles: payload.profiles,
      equipment: payload.equipment,
      items: payload.items,
      ...(payload.circuits?.length ? { circuits: payload.circuits } : {}),
      ...(payload.circuitSchemes?.length
        ? { circuitSchemes: payload.circuitSchemes }
        : {}),
      ...(payload.insignias?.length ? { insignias: payload.insignias } : {}),
      ...(payload.insigniaSchemes?.length
        ? { insigniaSchemes: payload.insigniaSchemes }
        : {}),
    });
  }
  return JSON.stringify(payload);
}

export async function encodeShareFragment(
  payload: SharePayload,
): Promise<string> {
  const json = serializePayload(payload);
  const bytes = new TextEncoder().encode(json);
  try {
    const compressed = await deflate(bytes);
    if (compressed.length < bytes.length) {
      return `${SHARE_HASH_PREFIX}z.${toBase64Url(compressed)}`;
    }
  } catch {
    // fall through
  }
  return `${SHARE_HASH_PREFIX}u.${toBase64Url(bytes)}`;
}

export async function decodeShareFragment(
  fragment: string,
): Promise<SharePayload | null> {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!raw.startsWith(SHARE_HASH_PREFIX)) return null;
  const body = raw.slice(SHARE_HASH_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot < 0) return null;
  const kind = body.slice(0, dot);
  const data = body.slice(dot + 1);
  if (!data) return null;

  try {
    let bytes = fromBase64Url(data);
    if (kind === "z") {
      bytes = await inflate(bytes);
    } else if (kind !== "u") {
      return null;
    }
    const json = new TextDecoder().decode(bytes);
    return parseSharePayload(JSON.parse(json));
  } catch {
    return null;
  }
}

export function buildShareUrl(
  fragment: string,
  baseUrl = window.location.href,
): string {
  const url = new URL(baseUrl);
  url.hash = fragment.startsWith("#") ? fragment : `#${fragment}`;
  return url.toString();
}

export function clearShareHash(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/**
 * Compact clipboard token: PREFIX.z|u.<base64url>.
 * Used by scheme share (迴路 / 徽記方案字串).
 */
export async function packToken(json: string, prefix: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  try {
    const compressed = await deflate(bytes);
    if (compressed.length < bytes.length) {
      return `${prefix}.z.${toBase64Url(compressed)}`;
    }
  } catch {
    // fall through
  }
  return `${prefix}.u.${toBase64Url(bytes)}`;
}

/** Pull the first COA-* token out of pasted text (whitespace / labels ignored). */
export function extractPackedToken(text: string): string {
  const compact = text.replace(/\s+/g, "");
  const match = compact.match(/COA-(?:CS|IS)1\.[zu]\.[A-Za-z0-9_-]+/i);
  return match ? match[0] : compact;
}

export async function unpackToken(
  text: string,
  expectedPrefix: string,
): Promise<unknown | null> {
  const raw = extractPackedToken(text);
  const prefix = `${expectedPrefix}.`;
  if (!raw.toUpperCase().startsWith(prefix.toUpperCase())) return null;
  const body = raw.slice(prefix.length);
  const dot = body.indexOf(".");
  if (dot < 0) return null;
  const kind = body.slice(0, dot).toLowerCase();
  const data = body.slice(dot + 1);
  if (!data) return null;
  try {
    let bytes = fromBase64Url(data);
    if (kind === "z") bytes = await inflate(bytes);
    else if (kind !== "u") return null;
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function mergeCatalogAdds(
  equipment: Equipment[],
  items: CatalogItem[],
  circuits: CircuitPiece[],
  schemes: CircuitScheme[],
  insignias: InsigniaPiece[],
  insigniaSchemes: InsigniaScheme[],
  knownEquipmentIds: Set<string>,
  knownItemIds: Set<string>,
  knownCircuitIds: Set<string>,
  knownSchemeIds: Set<string>,
  knownInsigniaIds: Set<string>,
  knownInsigniaSchemeIds: Set<string>,
  hiddenEquipmentIds: Set<string>,
  hiddenItemIds: Set<string>,
): Pick<
  ShareImportResult,
  | "equipmentToAdd"
  | "itemsToAdd"
  | "circuitsToAdd"
  | "schemesToAdd"
  | "insigniasToAdd"
  | "insigniaSchemesToAdd"
  | "unhideEquipmentIds"
  | "unhideItemIds"
> {
  const equipmentToAdd: Equipment[] = [];
  const unhideEquipmentIds: string[] = [];
  for (const eq of equipment) {
    if (hiddenEquipmentIds.has(eq.id)) unhideEquipmentIds.push(eq.id);
    if (!knownEquipmentIds.has(eq.id)) {
      equipmentToAdd.push({
        ...eq,
        demo: false,
        source: eq.source ?? "shared",
      });
    }
  }

  const itemsToAdd: CatalogItem[] = [];
  const unhideItemIds: string[] = [];
  for (const item of items) {
    if (hiddenItemIds.has(item.id)) unhideItemIds.push(item.id);
    if (!knownItemIds.has(item.id)) {
      itemsToAdd.push({ ...item, demo: false });
    }
  }

  const circuitsToAdd: CircuitPiece[] = [];
  for (const piece of circuits) {
    if (!knownCircuitIds.has(piece.id)) circuitsToAdd.push(piece);
  }
  const schemesToAdd: CircuitScheme[] = [];
  for (const scheme of schemes) {
    if (!knownSchemeIds.has(scheme.id)) schemesToAdd.push(scheme);
  }

  const insigniasToAdd: InsigniaPiece[] = [];
  for (const piece of insignias) {
    if (!knownInsigniaIds.has(piece.id)) insigniasToAdd.push(piece);
  }
  const insigniaSchemesToAdd: InsigniaScheme[] = [];
  for (const scheme of insigniaSchemes) {
    if (!knownInsigniaSchemeIds.has(scheme.id)) insigniaSchemesToAdd.push(scheme);
  }

  return {
    equipmentToAdd,
    itemsToAdd,
    circuitsToAdd,
    schemesToAdd,
    insigniasToAdd,
    insigniaSchemesToAdd,
    unhideEquipmentIds,
    unhideItemIds,
  };
}

function combatStatsEqual(a: CombatStats, b: CombatStats): boolean {
  for (const key of BASE_STAT_KEYS) {
    if (asFiniteNumber(a[key], 0) !== asFiniteNumber(b[key], 0)) return false;
  }
  return true;
}

function equippedEqual(
  a: Record<string, string | null>,
  b: Record<string, string | null>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key] || null;
    const bv = b[key] || null;
    if (av !== bv) return false;
  }
  return true;
}

function itemIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Content equality for full profiles (ignores id / note / timestamps). */
export function fullProfileContentEqual(a: Profile, b: Profile): boolean {
  return (
    a.name === b.name &&
    a.damageType === b.damageType &&
    (a.element ?? "all") === (b.element ?? "all") &&
    combatStatsEqual(a.base, b.base) &&
    equippedEqual(a.equipped, b.equipped) &&
    itemIdsEqual(a.itemIds, b.itemIds) &&
    (a.circuitSchemeId ?? null) === (b.circuitSchemeId ?? null) &&
    (a.insigniaSchemeId ?? null) === (b.insigniaSchemeId ?? null) &&
    (a.professionId ?? null) === (b.professionId ?? null) &&
    (parseObservedDamage(a.observedTrainingDamage) ?? null) ===
      (parseObservedDamage(b.observedTrainingDamage) ?? null)
  );
}

/** Content equality for stats-only shares (name + type + numeric bag). */
export function statsShareContentEqual(
  local: Profile,
  name: string,
  damageType: DamageType,
  stats: CombatStats,
): boolean {
  return (
    local.name === name &&
    local.damageType === damageType &&
    combatStatsEqual(local.base, stats)
  );
}

/**
 * Find an existing local profile that matches a full shared profile.
 * Prefer stable id, then content (covers older imports that reminted ids).
 */
function findExistingFullProfile(
  shared: Profile,
  existing: Profile[],
  claimedIds: Set<string>,
): Profile | null {
  const byId = existing.find(
    (p) => p.id === shared.id && !claimedIds.has(p.id),
  );
  if (byId) return byId;

  return (
    existing.find(
      (p) => !claimedIds.has(p.id) && fullProfileContentEqual(p, shared),
    ) ?? null
  );
}

function findExistingStatsProfile(
  name: string,
  damageType: DamageType,
  stats: CombatStats,
  existing: Profile[],
  claimedIds: Set<string>,
): Profile | null {
  return (
    existing.find(
      (p) =>
        !claimedIds.has(p.id) &&
        statsShareContentEqual(p, name, damageType, stats),
    ) ?? null
  );
}

function emptyCatalogAdds(): Pick<
  ShareImportResult,
  | "equipmentToAdd"
  | "itemsToAdd"
  | "circuitsToAdd"
  | "schemesToAdd"
  | "insigniasToAdd"
  | "insigniaSchemesToAdd"
  | "unhideEquipmentIds"
  | "unhideItemIds"
> {
  return {
    equipmentToAdd: [],
    itemsToAdd: [],
    circuitsToAdd: [],
    schemesToAdd: [],
    insigniasToAdd: [],
    insigniaSchemesToAdd: [],
    unhideEquipmentIds: [],
    unhideItemIds: [],
  };
}

/**
 * Prepare a shared payload for local import.
 * Skips profiles that already exist locally (same id or same content).
 * New full profiles keep their shared id when free, so re-visits dedupe cleanly.
 */
export function prepareShareImport(
  payload: SharePayload,
  knownEquipmentIds: Set<string>,
  knownItemIds: Set<string>,
  hiddenEquipmentIds: Set<string>,
  hiddenItemIds: Set<string>,
  existingProfiles: Profile[] = [],
  knownCircuitIds: Set<string> = new Set(),
  knownSchemeIds: Set<string> = new Set(),
  knownInsigniaIds: Set<string> = new Set(),
  knownInsigniaSchemeIds: Set<string> = new Set(),
): ShareImportResult {
  const now = new Date().toISOString();
  const claimedIds = new Set<string>();
  const profiles: Profile[] = [];
  const resolvedProfiles: Profile[] = [];
  let skippedDuplicates = 0;

  const takeExisting = (match: Profile): void => {
    claimedIds.add(match.id);
    resolvedProfiles.push(match);
    skippedDuplicates += 1;
  };

  const takeNew = (profile: Profile): void => {
    claimedIds.add(profile.id);
    profiles.push(profile);
    resolvedProfiles.push(profile);
  };

  if (isStatsPayload(payload)) {
    const stats = normalizeCombatStats(payload.stats);
    const existing = findExistingStatsProfile(
      payload.name,
      payload.damageType,
      stats,
      existingProfiles,
      claimedIds,
    );
    if (existing) {
      takeExisting(existing);
    } else {
      takeNew({
        id: makeId("profile"),
        name: payload.name,
        note: payload.note
          ? `${payload.note}（數值分享匯入）`
          : "從數值分享連結匯入",
        damageType: payload.damageType,
        element: "all",
        base: stats,
        equipped: {},
        itemIds: [],
        circuitSchemeId: null,
        insigniaSchemeId: null,
        professionId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return {
      profiles,
      resolvedProfiles,
      skippedDuplicates,
      ...emptyCatalogAdds(),
    };
  }

  if (isMultiStatsPayload(payload)) {
    for (const entry of payload.profiles) {
      const stats = normalizeCombatStats(entry.stats);
      const existing = findExistingStatsProfile(
        entry.name,
        entry.damageType,
        stats,
        existingProfiles,
        claimedIds,
      );
      if (existing) {
        takeExisting(existing);
        continue;
      }
      takeNew({
        id: makeId("profile"),
        name: entry.name,
        note: entry.note
          ? `${entry.note}（數值分享匯入）`
          : "從數值分享連結匯入",
        damageType: entry.damageType,
        element: "all",
        base: stats,
        equipped: {},
        itemIds: [],
        circuitSchemeId: null,
        insigniaSchemeId: null,
        professionId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return {
      profiles,
      resolvedProfiles,
      skippedDuplicates,
      ...emptyCatalogAdds(),
    };
  }

  const finishFull = (
    sharedList: Profile[],
    equipment: Equipment[],
    items: CatalogItem[],
    circuits: CircuitPiece[] = [],
    schemes: CircuitScheme[] = [],
    insignias: InsigniaPiece[] = [],
    insigniaSchemes: InsigniaScheme[] = [],
  ): ShareImportResult => {
    // Local ids already taken by stored profiles (or claimed this pass).
    const usedIds = new Set(existingProfiles.map((p) => p.id));

    for (const shared of sharedList) {
      const existing = findExistingFullProfile(
        shared,
        existingProfiles,
        claimedIds,
      );
      if (existing) {
        takeExisting(existing);
        continue;
      }

      // Prefer original shared id when free so re-opening the same URL dedupes.
      let id = shared.id;
      if (!id || usedIds.has(id) || claimedIds.has(id)) {
        id = makeId("profile");
      }
      usedIds.add(id);

      takeNew({
        ...shared,
        id,
        note: shared.note ? `${shared.note}（分享匯入）` : "從分享連結匯入",
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      profiles,
      resolvedProfiles,
      skippedDuplicates,
      ...mergeCatalogAdds(
        equipment,
        items,
        circuits,
        schemes,
        insignias,
        insigniaSchemes,
        knownEquipmentIds,
        knownItemIds,
        knownCircuitIds,
        knownSchemeIds,
        knownInsigniaIds,
        knownInsigniaSchemeIds,
        hiddenEquipmentIds,
        hiddenItemIds,
      ),
    };
  };

  if (isMultiFullPayload(payload)) {
    return finishFull(
      payload.profiles,
      payload.equipment,
      payload.items,
      payload.circuits ?? [],
      payload.circuitSchemes ?? [],
      payload.insignias ?? [],
      payload.insigniaSchemes ?? [],
    );
  }

  // v1 full single
  return finishFull(
    [payload.profile],
    payload.equipment,
    payload.items,
    payload.circuits ?? [],
    payload.circuitSchemes ?? [],
    payload.insignias ?? [],
    payload.insigniaSchemes ?? [],
  );
}

/** Soft warning threshold — many messengers truncate around ~2k–8k. */
export const SHARE_URL_WARN_LENGTH = 6000;
