import type {
  CircuitAffix,
  CircuitPiece,
  CircuitScheme,
  CircuitSlotId,
  CircuitStatKey,
  DeckPiece,
  DeckScheme,
  DeckSlotId,
  InsigniaAffix,
  InsigniaPiece,
  InsigniaScheme,
  InsigniaSlotId,
  InsigniaStatKey,
  PetPiece,
  PetScheme,
  PetSlotId,
} from "./types";
import { makeId } from "./damage";
import {
  CIRCUIT_SLOT_IDS,
  normalizeCircuitPiece,
  normalizeCircuitScheme,
} from "./circuit";
import {
  INSIGNIA_SLOT_IDS,
  normalizeInsigniaPiece,
  normalizeInsigniaScheme,
} from "./insignia";
import {
  DECK_SLOT_IDS,
  normalizeDeckPiece,
  normalizeDeckScheme,
} from "./deck";
import {
  PET_SLOT_IDS,
  normalizePetPiece,
  normalizePetScheme,
} from "./pet";
import { packToken, unpackToken } from "./share";

export const CIRCUIT_SCHEME_PREFIX = "COA-CS1";
export const INSIGNIA_SCHEME_PREFIX = "COA-IS1";
export const DECK_SCHEME_PREFIX = "COA-DS1";
export const PET_SCHEME_PREFIX = "COA-PS1";

type CompactAffix = [string, number];

type CompactCircuitPiece = {
  n?: string;
  k: string;
  m: CompactAffix;
  u?: CompactAffix[];
  b?: CompactAffix[];
};

type CompactCircuitShare = {
  v: 1;
  t: "c";
  n: string;
  o?: string;
  e: Array<[string, number]>;
  p: CompactCircuitPiece[];
};

type CompactInsigniaPiece = {
  n?: string;
  r: string;
  k: number;
  s: string[];
  a: CompactAffix[];
  o?: string;
};

type CompactInsigniaShare = {
  v: 1;
  t: "i";
  n: string;
  o?: string;
  e: Array<[string, number]>;
  p: CompactInsigniaPiece[];
};

export type CircuitSchemeBundle = {
  scheme: CircuitScheme;
  pieces: CircuitPiece[];
};

export type InsigniaSchemeBundle = {
  scheme: InsigniaScheme;
  pieces: InsigniaPiece[];
};

export type DeckSchemeBundle = {
  scheme: DeckScheme;
  pieces: DeckPiece[];
};

export type PetSchemeBundle = {
  scheme: PetScheme;
  pieces: PetPiece[];
};

export type SchemeShareKind = "circuit" | "insignia" | "deck" | "pet";

function compactAffix(stat: string, value: number): CompactAffix {
  return [stat, value];
}

function expandAffix(raw: unknown): { stat: string; value: number } | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const stat = raw[0];
  const value = typeof raw[1] === "number" ? raw[1] : Number(raw[1]);
  if (typeof stat !== "string" || !stat || !Number.isFinite(value)) return null;
  return { stat, value };
}

function uniqueSchemeName(base: string, existingNames: string[]): string {
  const names = new Set(existingNames);
  const trimmed = base.trim() || "匯入方案";
  if (!names.has(trimmed)) return trimmed;
  const imported = `${trimmed}（匯入）`;
  if (!names.has(imported)) return imported;
  let n = 2;
  while (names.has(`${trimmed}（匯入 ${n}）`)) n += 1;
  return `${trimmed}（匯入 ${n}）`;
}

function collectCircuitPieces(
  scheme: CircuitScheme,
  piecesById: Map<string, CircuitPiece>,
): CircuitPiece[] {
  const out: CircuitPiece[] = [];
  const seen = new Set<string>();
  for (const slot of CIRCUIT_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    seen.add(id);
    out.push(piece);
  }
  return out;
}

function collectInsigniaPieces(
  scheme: InsigniaScheme,
  piecesById: Map<string, InsigniaPiece>,
): InsigniaPiece[] {
  const out: InsigniaPiece[] = [];
  const seen = new Set<string>();
  for (const slot of INSIGNIA_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    seen.add(id);
    out.push(piece);
  }
  return out;
}

function collectDeckPieces(
  scheme: DeckScheme,
  piecesById: Map<string, DeckPiece>,
): DeckPiece[] {
  const out: DeckPiece[] = [];
  const seen = new Set<string>();
  for (const slot of DECK_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    seen.add(id);
    out.push(piece);
  }
  return out;
}

export async function encodeCircuitSchemeCode(
  scheme: CircuitScheme,
  piecesById: Map<string, CircuitPiece>,
): Promise<string> {
  const pieces = collectCircuitPieces(scheme, piecesById);
  const indexById = new Map(pieces.map((p, i) => [p.id, i]));
  const equipped: Array<[string, number]> = [];
  for (const slot of CIRCUIT_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id) continue;
    const index = indexById.get(id);
    if (index === undefined) continue;
    equipped.push([slot, index]);
  }
  const payload: CompactCircuitShare = {
    v: 1,
    t: "c",
    n: scheme.name,
    ...(scheme.note.trim() ? { o: scheme.note } : {}),
    e: equipped,
    p: pieces.map((piece) => ({
      ...(piece.name.trim() ? { n: piece.name } : {}),
      k: piece.kind,
      m: compactAffix(piece.main.stat, piece.main.value),
      ...(piece.subs.length
        ? { u: piece.subs.map((a) => compactAffix(a.stat, a.value)) }
        : {}),
      ...((piece.breakthroughs ?? []).length
        ? {
            b: (piece.breakthroughs ?? []).map((a) =>
              compactAffix(a.stat, a.value),
            ),
          }
        : {}),
    })),
  };
  return packToken(JSON.stringify(payload), CIRCUIT_SCHEME_PREFIX);
}

export async function encodeInsigniaSchemeCode(
  scheme: InsigniaScheme,
  piecesById: Map<string, InsigniaPiece>,
): Promise<string> {
  const pieces = collectInsigniaPieces(scheme, piecesById);
  const indexById = new Map(pieces.map((p, i) => [p.id, i]));
  const equipped: Array<[string, number]> = [];
  for (const slot of INSIGNIA_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id) continue;
    const index = indexById.get(id);
    if (index === undefined) continue;
    equipped.push([slot, index]);
  }
  const payload: CompactInsigniaShare = {
    v: 1,
    t: "i",
    n: scheme.name,
    ...(scheme.note.trim() ? { o: scheme.note } : {}),
    e: equipped,
    p: pieces.map((piece) => ({
      ...(piece.name.trim() ? { n: piece.name } : {}),
      r: piece.rarity,
      k: piece.rank,
      s: [...piece.slots],
      a: piece.affixes.map((a) => compactAffix(a.stat, a.value)),
      ...(piece.note.trim() ? { o: piece.note } : {}),
    })),
  };
  return packToken(JSON.stringify(payload), INSIGNIA_SCHEME_PREFIX);
}

function parseCircuitShare(raw: unknown): CircuitSchemeBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (src.v !== 1 || src.t !== "c") return null;
  if (!Array.isArray(src.p)) return null;
  const now = new Date().toISOString();
  const pieces: CircuitPiece[] = [];
  for (const item of src.p) {
    if (!item || typeof item !== "object") continue;
    const p = item as CompactCircuitPiece;
    const main = expandAffix(p.m);
    const piece = normalizeCircuitPiece({
      id: makeId("circuit"),
      name: typeof p.n === "string" ? p.n : "",
      kind: p.k,
      main: main
        ? { stat: main.stat as CircuitStatKey, value: main.value }
        : undefined,
      subs: (p.u ?? [])
        .map(expandAffix)
        .filter((x): x is CircuitAffix => x !== null)
        .map((x) => ({ stat: x.stat as CircuitStatKey, value: x.value })),
      breakthroughs: (p.b ?? [])
        .map(expandAffix)
        .filter((x): x is CircuitAffix => x !== null)
        .map((x) => ({ stat: x.stat as CircuitStatKey, value: x.value })),
      createdAt: now,
      updatedAt: now,
    });
    if (piece) pieces.push(piece);
  }

  const equipped: CircuitScheme["equipped"] = {};
  if (Array.isArray(src.e)) {
    for (const row of src.e) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const slot = row[0];
      const index = typeof row[1] === "number" ? row[1] : Number(row[1]);
      if (typeof slot !== "string" || !Number.isInteger(index)) continue;
      if (!(CIRCUIT_SLOT_IDS as string[]).includes(slot)) continue;
      const piece = pieces[index];
      if (!piece) continue;
      equipped[slot as CircuitSlotId] = piece.id;
    }
  }

  const scheme = normalizeCircuitScheme({
    id: makeId("cscheme"),
    name: typeof src.n === "string" ? src.n : "迴路方案",
    note: typeof src.o === "string" ? src.o : "",
    equipped,
    createdAt: now,
    updatedAt: now,
  });
  if (!scheme) return null;
  return { scheme, pieces };
}

function parseInsigniaShare(raw: unknown): InsigniaSchemeBundle | null {  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (src.v !== 1 || src.t !== "i") return null;
  if (!Array.isArray(src.p)) return null;
  const now = new Date().toISOString();
  const pieces: InsigniaPiece[] = [];
  for (const item of src.p) {
    if (!item || typeof item !== "object") continue;
    const p = item as CompactInsigniaPiece;
    const piece = normalizeInsigniaPiece({
      id: makeId("insignia"),
      name: typeof p.n === "string" ? p.n : "",
      rarity: p.r,
      rank: p.k,
      slots: Array.isArray(p.s) ? p.s : [],
      affixes: (p.a ?? [])
        .map(expandAffix)
        .filter((x): x is InsigniaAffix => x !== null)
        .map((x) => ({ stat: x.stat as InsigniaStatKey, value: x.value })),
      note: typeof p.o === "string" ? p.o : "",
      createdAt: now,
      updatedAt: now,
    });
    if (piece) pieces.push(piece);
  }

  const equipped: InsigniaScheme["equipped"] = {};
  if (Array.isArray(src.e)) {
    for (const row of src.e) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const slot = row[0];
      const index = typeof row[1] === "number" ? row[1] : Number(row[1]);
      if (typeof slot !== "string" || !Number.isInteger(index)) continue;
      if (!(INSIGNIA_SLOT_IDS as string[]).includes(slot)) continue;
      const piece = pieces[index];
      if (!piece) continue;
      equipped[slot as InsigniaSlotId] = piece.id;
    }
  }

  const scheme = normalizeInsigniaScheme({
    id: makeId("ischeme"),
    name: typeof src.n === "string" ? src.n : "徽記方案",
    note: typeof src.o === "string" ? src.o : "",
    equipped,
    createdAt: now,
    updatedAt: now,
  });
  if (!scheme) return null;
  return { scheme, pieces };
}

export async function encodeDeckSchemeCode(
  scheme: DeckScheme,
  piecesById: Map<string, DeckPiece>,
): Promise<string> {
  const pieces = collectDeckPieces(scheme, piecesById);
  const indexById = new Map(pieces.map((p, i) => [p.id, i]));
  const equipped: Array<[string, number]> = [];
  for (const slot of DECK_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id) continue;
    const index = indexById.get(id);
    if (index === undefined) continue;
    equipped.push([slot, index]);
  }
  const payload = {
    v: 1,
    t: "d",
    n: scheme.name,
    ...(scheme.note.trim() ? { o: scheme.note } : {}),
    e: equipped,
    p: pieces.map((piece) => ({
      ...(piece.name.trim() ? { n: piece.name } : {}),
      a: piece.affixes.map((a) => compactAffix(a.stat, a.value)),
      ...(piece.note.trim() ? { o: piece.note } : {}),
    })),
  };
  return packToken(JSON.stringify(payload), DECK_SCHEME_PREFIX);
}

function parseDeckShare(raw: unknown): DeckSchemeBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (src.v !== 1 || src.t !== "d") return null;
  if (!Array.isArray(src.p)) return null;
  const now = new Date().toISOString();
  const pieces: DeckPiece[] = [];
  for (const item of src.p) {
    if (!item || typeof item !== "object") continue;
    const p = item as { n?: string; a?: unknown[]; o?: string };
    const piece = normalizeDeckPiece({
      id: makeId("dpc"),
      name: typeof p.n === "string" ? p.n : "",
      affixes: (p.a ?? [])
        .map(expandAffix)
        .filter((x): x is InsigniaAffix => x !== null)
        .map((x) => ({ stat: x.stat as InsigniaStatKey, value: x.value })),
      note: typeof p.o === "string" ? p.o : "",
      createdAt: now,
      updatedAt: now,
    });
    if (piece) pieces.push(piece);
  }

  const equipped: DeckScheme["equipped"] = {};
  if (Array.isArray(src.e)) {
    for (const row of src.e) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const slot = row[0];
      const index = typeof row[1] === "number" ? row[1] : Number(row[1]);
      if (typeof slot !== "string" || !Number.isInteger(index)) continue;
      if (!(DECK_SLOT_IDS as string[]).includes(slot)) continue;
      const piece = pieces[index];
      if (!piece) continue;
      equipped[slot as DeckSlotId] = piece.id;
    }
  }

  const scheme = normalizeDeckScheme({
    id: makeId("dsch"),
    name: typeof src.n === "string" ? src.n : "牌組方案",
    note: typeof src.o === "string" ? src.o : "",
    equipped,
    createdAt: now,
    updatedAt: now,
  });
  if (!scheme) return null;
  return { scheme, pieces };
}

export async function decodeDeckSchemeCode(
  text: string,
): Promise<DeckSchemeBundle | null> {
  const raw = await unpackToken(text, DECK_SCHEME_PREFIX);
  return parseDeckShare(raw);
}

export function finalizeDeckSchemeImport(
  bundle: DeckSchemeBundle,
  existingNames: string[],
): DeckSchemeBundle {
  return {
    scheme: {
      ...bundle.scheme,
      name: uniqueSchemeName(bundle.scheme.name, existingNames),
    },
    pieces: bundle.pieces,
  };
}

function collectPetPieces(
  scheme: PetScheme,
  piecesById: Map<string, PetPiece>,
): PetPiece[] {
  const out: PetPiece[] = [];
  const seen = new Set<string>();
  for (const slot of PET_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    seen.add(id);
    out.push(piece);
  }
  return out;
}

export async function encodePetSchemeCode(
  scheme: PetScheme,
  piecesById: Map<string, PetPiece>,
): Promise<string> {
  const pieces = collectPetPieces(scheme, piecesById);
  const indexById = new Map(pieces.map((p, i) => [p.id, i]));
  const equipped: Array<[string, number]> = [];
  for (const slot of PET_SLOT_IDS) {
    const id = scheme.equipped[slot];
    if (!id) continue;
    const index = indexById.get(id);
    if (index === undefined) continue;
    equipped.push([slot, index]);
  }
  const payload = {
    v: 1,
    t: "p",
    n: scheme.name,
    ...(scheme.note.trim() ? { o: scheme.note } : {}),
    e: equipped,
    p: pieces.map((piece) => ({
      ...(piece.name.trim() ? { n: piece.name } : {}),
      a: piece.affixes.map((a) => compactAffix(a.stat, a.value)),
      ...(piece.note.trim() ? { o: piece.note } : {}),
    })),
  };
  return packToken(JSON.stringify(payload), PET_SCHEME_PREFIX);
}

function parsePetShare(raw: unknown): PetSchemeBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (src.v !== 1 || src.t !== "p") return null;
  if (!Array.isArray(src.p)) return null;
  const now = new Date().toISOString();
  const pieces: PetPiece[] = [];
  for (const item of src.p) {
    if (!item || typeof item !== "object") continue;
    const p = item as { n?: string; a?: unknown[]; o?: string };
    const piece = normalizePetPiece({
      id: makeId("pet"),
      name: typeof p.n === "string" ? p.n : "",
      affixes: (p.a ?? [])
        .map(expandAffix)
        .filter((x): x is InsigniaAffix => x != null)
        .map((x) => ({ stat: x.stat as InsigniaStatKey, value: x.value })),
      note: typeof p.o === "string" ? p.o : "",
      createdAt: now,
      updatedAt: now,
    });
    if (piece) pieces.push(piece);
  }

  const equipped: PetScheme["equipped"] = {};
  if (Array.isArray(src.e)) {
    for (const row of src.e) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const slot = row[0];
      const index = typeof row[1] === "number" ? row[1] : Number(row[1]);
      if (typeof slot !== "string" || !Number.isInteger(index)) continue;
      if (!(PET_SLOT_IDS as string[]).includes(slot)) continue;
      const piece = pieces[index];
      if (!piece) continue;
      equipped[slot as PetSlotId] = piece.id;
    }
  }

  const scheme = normalizePetScheme({
    id: makeId("psch"),
    name: typeof src.n === "string" ? src.n : "寵物方案",
    note: typeof src.o === "string" ? src.o : "",
    equipped,
    createdAt: now,
    updatedAt: now,
  });
  if (!scheme) return null;
  return { scheme, pieces };
}

export async function decodePetSchemeCode(
  text: string,
): Promise<PetSchemeBundle | null> {
  const raw = await unpackToken(text, PET_SCHEME_PREFIX);
  return parsePetShare(raw);
}

export function finalizePetSchemeImport(
  bundle: PetSchemeBundle,
  existingNames: string[],
): PetSchemeBundle {
  return {
    scheme: {
      ...bundle.scheme,
      name: uniqueSchemeName(bundle.scheme.name, existingNames),
    },
    pieces: bundle.pieces,
  };
}

export function peekSchemeShareKind(text: string): SchemeShareKind | null {
  const compact = text.replace(/\s+/g, "").toUpperCase();
  if (compact.includes("COA-CS1.")) return "circuit";
  if (compact.includes("COA-IS1.")) return "insignia";
  if (compact.includes("COA-DS1.")) return "deck";
  if (compact.includes("COA-PS1.")) return "pet";
  return null;
}

export async function decodeCircuitSchemeCode(
  text: string,
): Promise<CircuitSchemeBundle | null> {
  const raw = await unpackToken(text, CIRCUIT_SCHEME_PREFIX);
  return parseCircuitShare(raw);
}

export async function decodeInsigniaSchemeCode(
  text: string,
): Promise<InsigniaSchemeBundle | null> {
  const raw = await unpackToken(text, INSIGNIA_SCHEME_PREFIX);
  return parseInsigniaShare(raw);
}

export function finalizeCircuitSchemeImport(
  bundle: CircuitSchemeBundle,
  existingNames: string[],
): CircuitSchemeBundle {
  return {
    scheme: {
      ...bundle.scheme,
      name: uniqueSchemeName(bundle.scheme.name, existingNames),
    },
    pieces: bundle.pieces,
  };
}

export function finalizeInsigniaSchemeImport(
  bundle: InsigniaSchemeBundle,
  existingNames: string[],
): InsigniaSchemeBundle {
  return {
    scheme: {
      ...bundle.scheme,
      name: uniqueSchemeName(bundle.scheme.name, existingNames),
    },
    pieces: bundle.pieces,
  };
}
