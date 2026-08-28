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
} from "./insignia";
import { insigniaStatLabel } from "./i18n";
import type {
  CircuitElement,
  InsigniaAffix,
  PetPiece,
  PetScheme,
  PetSlotId,
  StatBag,
} from "./types";

export const PET_SLOT_IDS: PetSlotId[] = ["1", "2"];

export function isPetSlotId(value: string): value is PetSlotId {
  return (PET_SLOT_IDS as string[]).includes(value);
}

/** Reuses the insignia stat vocabulary (incl. pet damage). */
export const PET_STAT_OPTIONS: string[] = INSIGNIA_STAT_OPTIONS as string[];
export const PET_PERCENT_STATS: Set<string> = INSIGNIA_PERCENT_STATS as Set<string>;
export const petStatLabel = insigniaStatLabel;

export function blankPetPiece(): PetPiece {
  const now = new Date().toISOString();
  return {
    id: makeId("pet"),
    name: "",
    affixes: [],
    note: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blankPetScheme(name?: string): PetScheme {
  const now = new Date().toISOString();
  return {
    id: makeId("psch"),
    name: name ?? "新的寵物",
    note: "",
    equipped: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultPetName(piece: PetPiece): string {
  const base = piece.name.trim() || "寵物";
  return `${base} 寵物`;
}

/** A pet can be placed in any of the 2 slots. */
export function canSocketIn(_piece: PetPiece, _slot: PetSlotId): boolean {
  return true;
}

export function pieceContribution(
  piece: PetPiece,
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
  scheme: PetScheme,
  piecesById: Map<string, PetPiece>,
  element: CircuitElement | "all",
): InsigniaContribution {
  return genericSchemeContribution(
    scheme,
    piecesById,
    {
      slotIds: PET_SLOT_IDS,
      isSocketValid: (piece, slot) => canSocketIn(piece, slot),
      pieceContribution,
      emptyExtra,
      mergeExtra,
    },
    element,
  );
}

export type PetContribution = InsigniaContribution;
export type PetComparison = LoadoutComparison<PetPiece, PetSlotId>;

export const equippedCount = (scheme: PetScheme): number =>
  countEquipped(scheme, PET_SLOT_IDS);

export const listEquippedPets = (
  scheme: PetScheme,
  piecesById: Map<string, PetPiece>,
): LoadoutEquipped<PetPiece, PetSlotId>[] =>
  listEquipped(scheme, piecesById, PET_SLOT_IDS, (p, s) =>
    canSocketIn(p, s),
  );

export const unequipPet = (scheme: PetScheme, id: string): PetScheme =>
  loadoutUnequip(scheme, PET_SLOT_IDS, id);

export const assignPetToSlot = (
  scheme: PetScheme,
  slot: PetSlotId,
  id: string | null,
): PetScheme => loadoutAssignToSlot(scheme, PET_SLOT_IDS, slot, id);

export const detachPetsFromSchemes = (
  schemes: PetScheme[],
  ids: Set<string>,
): PetScheme[] => loadoutDetach(schemes, PET_SLOT_IDS, [...ids]);

export function compareSchemePets(
  scheme: PetScheme,
  pieces: PetPiece[],
  piecesById: Map<string, PetPiece>,
  damageOf: (scheme: PetScheme | null) => number,
): PetComparison {
  return compareLoadout(
    scheme,
    pieces,
    piecesById,
    damageOf,
    {
      slotIds: PET_SLOT_IDS,
      isSocketValid: (piece, slot) => canSocketIn(piece, slot),
      slotsForPiece: () => PET_SLOT_IDS,
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

export function normalizePetPiece(input: unknown): PetPiece | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : makeId("pet");
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

export function normalizePetScheme(input: unknown): PetScheme | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : makeId("psch");
  const name = typeof raw.name === "string" ? raw.name : "寵物";
  const note = typeof raw.note === "string" ? raw.note : "";
  const equipped: Partial<Record<PetSlotId, string | null>> = {};
  if (raw.equipped && typeof raw.equipped === "object") {
    const eq = raw.equipped as Record<string, unknown>;
    for (const sid of PET_SLOT_IDS) {
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

export const formatPetAffix = formatInsigniaAffix;
export const formatPetStatValue = formatInsigniaStatValue;
export const petInputValue = insigniaInputValue;
export const parsePetInput = parseInsigniaInput;
export { contributionLines };
