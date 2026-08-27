import { makeId } from "./damage";
import {
  assignToSlot as loadoutAssignToSlot,
  compareLoadout,
  countEquipped,
  detachFromSchemes as loadoutDetach,
  genericSchemeContribution,
  listEquipped,
  unequipPiece as loadoutUnequip,
  type LoadoutComparison,
  type LoadoutEquipped,
} from "./loadout";
import {
  applyInsigniaAffix,
  contributionLines,
  emptyExtra,
  formatInsigniaAffix,
  formatInsigniaStatValue,
  INSIGNIA_PERCENT_STATS,
  INSIGNIA_STAT_LABEL,
  INSIGNIA_STAT_OPTIONS,
  insigniaInputValue,
  mergeExtra,
  parseInsigniaInput,
  type InsigniaContribution,
  type InsigniaExtraStats,
} from "./insignia";
import { insigniaStatLabel } from "./i18n";
import type {
  CircuitElement,
  DeckPiece,
  DeckScheme,
  DeckSlotId,
  InsigniaAffix,
  StatBag,
} from "./types";

export const DECK_SLOT_IDS: DeckSlotId[] = ["1", "2", "3", "4"];

export function isDeckSlotId(value: string): value is DeckSlotId {
  return (DECK_SLOT_IDS as string[]).includes(value);
}

/** Reuses the insignia stat vocabulary (incl. pet damage). */
export const DECK_STAT_OPTIONS: string[] = INSIGNIA_STAT_OPTIONS as string[];
export const DECK_PERCENT_STATS: Set<string> = INSIGNIA_PERCENT_STATS as Set<string>;
export const deckStatLabel = insigniaStatLabel;

export function blankDeckPiece(): DeckPiece {
  const now = new Date().toISOString();
  return {
    id: makeId("dpc"),
    name: "",
    affixes: [],
    note: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blankDeckScheme(name?: string): DeckScheme {
  const now = new Date().toISOString();
  return {
    id: makeId("dsch"),
    name: name ?? "新的牌組",
    note: "",
    equipped: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultDeckName(piece: DeckPiece): string {
  const base = piece.name.trim() || "牌組";
  return `${base} 牌組`;
}

/** A deck card can be placed in any of the 4 positions. */
export function canSocketIn(_piece: DeckPiece, _slot: DeckSlotId): boolean {
  return true;
}

export function applyDeckAffix(
  affix: InsigniaAffix,
  bag: StatBag,
  extra: InsigniaExtraStats,
  element: CircuitElement | "all",
): void {
  applyInsigniaAffix(affix, bag, extra, element);
}

export function pieceContribution(
  piece: DeckPiece,
  element: CircuitElement | "all",
): InsigniaContribution {
  const bag: StatBag = {};
  const extra = emptyExtra();
  for (const affix of piece.affixes) {
    applyInsigniaAffix(affix, bag, extra, element);
  }
  return { bag, extra };
}

export function schemeContribution(
  scheme: DeckScheme,
  piecesById: Map<string, DeckPiece>,
  element: CircuitElement | "all",
): InsigniaContribution {
  return genericSchemeContribution(
    scheme,
    piecesById,
    {
      slotIds: DECK_SLOT_IDS,
      isSocketValid: (piece, slot) => canSocketIn(piece, slot),
      pieceContribution,
      emptyExtra,
      mergeExtra,
    },
    element,
  );
}

export type DeckContribution = InsigniaContribution;
export type DeckComparison = LoadoutComparison<DeckPiece, DeckSlotId>;

export const equippedCount = (scheme: DeckScheme): number =>
  countEquipped(scheme, DECK_SLOT_IDS);

export const listEquippedDecks = (
  scheme: DeckScheme,
  piecesById: Map<string, DeckPiece>,
): LoadoutEquipped<DeckPiece, DeckSlotId>[] =>
  listEquipped(scheme, piecesById, DECK_SLOT_IDS, (p, s) =>
    canSocketIn(p, s),
  );

export const unequipDeck = (scheme: DeckScheme, id: string): DeckScheme =>
  loadoutUnequip(scheme, DECK_SLOT_IDS, id);

export const assignDeckToSlot = (
  scheme: DeckScheme,
  slot: DeckSlotId,
  id: string | null,
): DeckScheme => loadoutAssignToSlot(scheme, DECK_SLOT_IDS, slot, id);

export const detachDecksFromSchemes = (
  schemes: DeckScheme[],
  ids: Set<string>,
): DeckScheme[] => loadoutDetach(schemes, DECK_SLOT_IDS, [...ids]);

export function compareSchemeDecks(
  scheme: DeckScheme,
  pieces: DeckPiece[],
  piecesById: Map<string, DeckPiece>,
  damageOf: (scheme: DeckScheme | null) => number,
): DeckComparison {
  return compareLoadout(
    scheme,
    pieces,
    piecesById,
    damageOf,
    {
      slotIds: DECK_SLOT_IDS,
      isSocketValid: (piece, slot) => canSocketIn(piece, slot),
      slotsForPiece: () => DECK_SLOT_IDS,
    },
  );
}

function normalizeAffix(input: unknown): InsigniaAffix | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const stat = typeof raw.stat === "string" ? raw.stat : "";
  if (!stat || !(stat in INSIGNIA_STAT_LABEL)) return null;
  const value = typeof raw.value === "number" ? raw.value : 0;
  return { stat: stat as InsigniaAffix["stat"], value };
}

export function normalizeDeckPiece(input: unknown): DeckPiece | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : makeId("dpc");
  const name = typeof raw.name === "string" ? raw.name : "";
  const affixes = Array.isArray(raw.affixes)
    ? raw.affixes
        .map((a) => normalizeAffix(a))
        .filter((a): a is InsigniaAffix => a != null)
    : [];
  const note = typeof raw.note === "string" ? raw.note : "";
  const now = new Date().toISOString();
  return {
    id,
    name,
    affixes,
    note,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export function normalizeDeckScheme(input: unknown): DeckScheme | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : makeId("dsch");
  const name = typeof raw.name === "string" ? raw.name : "牌組";
  const note = typeof raw.note === "string" ? raw.note : "";
  const equipped: Partial<Record<DeckSlotId, string | null>> = {};
  if (raw.equipped && typeof raw.equipped === "object") {
    const eq = raw.equipped as Record<string, unknown>;
    for (const sid of DECK_SLOT_IDS) {
      const v = eq[sid];
      if (v === null || typeof v === "string") {
        equipped[sid] = v ?? null;
      }
    }
  }
  const now = new Date().toISOString();
  return {
    id,
    name,
    note,
    equipped,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export const formatDeckAffix = formatInsigniaAffix;
export const formatDeckStatValue = formatInsigniaStatValue;
export const deckInputValue = insigniaInputValue;
export const parseDeckInput = parseInsigniaInput;
export { contributionLines };
