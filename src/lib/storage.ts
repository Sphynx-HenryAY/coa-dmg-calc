import type {
  CatalogItem,
  CircuitPiece,
  CircuitScheme,
  Equipment,
  InsigniaPiece,
  InsigniaScheme,
  ProfessionDef,
  ProfessionOverride,
  Profile,
} from "./types";
import { activeSourceIdsOf } from "./types";
import demoData from "../data/demoData.json";
import { parseObservedDamage } from "./compare";
import { emptyStats, makeId } from "./damage";
import { normalizeCircuitPiece, normalizeCircuitScheme } from "./circuit";
import {
  normalizeInsigniaPiece,
  normalizeInsigniaScheme,
} from "./insignia";
import {
  normalizeCustomProfession,
  normalizeProfessionOverride,
} from "./profession";

const STORAGE_KEY = "coa-dmg-calc:v1";

export type PersistedState = {
  profiles: Profile[];
  customEquipment: Equipment[];
  customItems: CatalogItem[];
  circuits: CircuitPiece[];
  circuitSchemes: CircuitScheme[];
  insignias: InsigniaPiece[];
  insigniaSchemes: InsigniaScheme[];
  /** Local edits to built-in profession cycles. */
  professionOverrides: ProfessionOverride[];
  /** User-created professions (not in the built-in catalog). */
  customProfessions: ProfessionDef[];
  /** Demo equipment ids the user deleted (hidden from catalog). */
  hiddenEquipmentIds: string[];
  /** Demo item ids the user deleted. */
  hiddenItemIds: string[];
  compareIds: string[];
  activeProfileId: string | null;
};

export function getDemoEquipment(): Equipment[] {
  return demoData.equipment as Equipment[];
}

export function getDemoItems(): CatalogItem[] {
  return demoData.items as CatalogItem[];
}

function emptyPersistedState(): PersistedState {
  return {
    profiles: [],
    customEquipment: [],
    customItems: [],
    circuits: [],
    circuitSchemes: [],
    insignias: [],
    insigniaSchemes: [],
    professionOverrides: [],
    customProfessions: [],
    hiddenEquipmentIds: [],
    hiddenItemIds: [],
    compareIds: [],
    activeProfileId: null,
  };
}

function normalizeStoredProfile(raw: Profile): Profile {
  const merged: Profile = {
    ...raw,
    element: raw.element ?? "all",
    circuitSchemeId: raw.circuitSchemeId ?? null,
    insigniaSchemeId: raw.insigniaSchemeId ?? null,
    professionId: raw.professionId ?? null,
    observedTrainingDamage: parseObservedDamage(raw.observedTrainingDamage),
  };
  merged.activeSourceIds = activeSourceIdsOf(merged);
  return merged;
}

/** True when the user already has saved app state in this browser. */
export function hasStoredState(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersistedState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.profiles)) throw new Error("bad profiles");
    return {
      profiles: parsed.profiles.map(normalizeStoredProfile),
      customEquipment: parsed.customEquipment ?? [],
      customItems: parsed.customItems ?? [],
      circuits: (parsed.circuits ?? [])
        .map(normalizeCircuitPiece)
        .filter((x): x is CircuitPiece => x !== null),
      circuitSchemes: (parsed.circuitSchemes ?? [])
        .map(normalizeCircuitScheme)
        .filter((x): x is CircuitScheme => x !== null),
      insignias: (parsed.insignias ?? [])
        .map(normalizeInsigniaPiece)
        .filter((x): x is InsigniaPiece => x !== null),
      insigniaSchemes: (parsed.insigniaSchemes ?? [])
        .map(normalizeInsigniaScheme)
        .filter((x): x is InsigniaScheme => x !== null),
      professionOverrides: (parsed.professionOverrides ?? [])
        .map(normalizeProfessionOverride)
        .filter((x): x is ProfessionOverride => x !== null),
      customProfessions: (parsed.customProfessions ?? [])
        .map(normalizeCustomProfession)
        .filter((x): x is ProfessionDef => x !== null),
      hiddenEquipmentIds: parsed.hiddenEquipmentIds ?? [],
      hiddenItemIds: parsed.hiddenItemIds ?? [],
      compareIds: parsed.compareIds ?? [],
      activeProfileId: parsed.activeProfileId ?? parsed.profiles[0]?.id ?? null,
    };
  } catch {
    return emptyPersistedState();
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profiles: state.profiles,
      customEquipment: state.customEquipment,
      customItems: state.customItems,
      circuits: state.circuits,
      circuitSchemes: state.circuitSchemes,
      insignias: state.insignias,
      insigniaSchemes: state.insigniaSchemes,
      professionOverrides: state.professionOverrides,
      customProfessions: state.customProfessions,
      hiddenEquipmentIds: state.hiddenEquipmentIds,
      hiddenItemIds: state.hiddenItemIds,
      compareIds: state.compareIds,
      activeProfileId: state.activeProfileId,
    }),
  );
}

export function blankProfile(name = "新配置"): Profile {
  const now = new Date().toISOString();
  return {
    id: makeId("profile"),
    name,
    note: "",
    damageType: "magic",
    base: {
      ...emptyStats(),
      attack: 20000,
      defenseBreak: 8000,
      critRate: 0.5,
      critDamage: 1.5,
      elementalPower: 200,
      skillDamage: 0.4,
      resonance: 0.1,
      damageBoost: 0.5,
      trainingCorrection: 0.08,
      skillMultiplier: 1,
    },
    element: "all",
    equipped: {},
    itemIds: [],
    activeSourceIds: [],
    circuitSchemeId: null,
    insigniaSchemeId: null,
    professionId: null,
    observedTrainingDamage: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const EQUIPMENT_SLOTS = [
  "頭",
  "身",
  "手",
  "褲",
  "鞋",
  "武器",
  "項鍊",
  "頸鍊",
  "腕帶",
  "戒指",
  "印章",
  "護符",
  "防具套裝",
  "飾品套裝",
  "套裝效果",
  "腕帶效果",
  "戒指效果",
  "印章效果",
  "護符效果",
] as const;
