import type { CatalogItem, Equipment, Profile } from "./types";
import demoData from "../data/demoData.json";
import { emptyStats, makeId } from "./damage";

const STORAGE_KEY = "coa-dmg-calc:v1";

export type PersistedState = {
  profiles: Profile[];
  customEquipment: Equipment[];
  customItems: CatalogItem[];
  compareIds: string[];
  activeProfileId: string | null;
};

export function getDemoEquipment(): Equipment[] {
  return demoData.equipment as Equipment[];
}

export function getDemoItems(): CatalogItem[] {
  return demoData.items as CatalogItem[];
}

function statsFrom(raw: {
  attack: number;
  defenseBreak: number;
  critRate: number;
  critDamage: number;
  elementalPower: number;
  skillDamage: number;
  resonance: number;
  damageBoost: number;
  circuitBoost: number;
  allElementDamage: number;
  additionalDamage: number;
  statusDamage: number;
  bossDamage: number;
  penetration: number;
  trainingCorrection: number;
  skillMultiplier: number;
}): Profile["base"] {
  return {
    attack: raw.attack,
    defenseBreak: raw.defenseBreak,
    critRate: raw.critRate,
    critDamage: raw.critDamage,
    elementalPower: raw.elementalPower,
    skillDamage: raw.skillDamage,
    resonance: raw.resonance,
    damageBoost: raw.damageBoost,
    circuitBoost: raw.circuitBoost,
    allElementDamage: raw.allElementDamage,
    additionalDamage: raw.additionalDamage,
    statusDamage: raw.statusDamage,
    bossDamage: raw.bossDamage,
    penetration: raw.penetration,
    trainingCorrection: raw.trainingCorrection,
    skillMultiplier: raw.skillMultiplier,
  };
}

export function createDefaultProfiles(): Profile[] {
  const now = new Date().toISOString();
  const base = demoData.baseline;
  const bare = demoData.bareBase;

  // 嗚、滿效果 row from siumai 傷害 (2026/7/12)
  const fullBuff = {
    attack: 30639,
    defenseBreak: 10411,
    critRate: 1.0,
    critDamage: 3.5,
    elementalPower: 489.0,
    skillDamage: 1.433,
    resonance: 0.825,
    damageBoost: 2.686,
    circuitBoost: 0,
    allElementDamage: 0.354,
    additionalDamage: 0.4,
    statusDamage: 0.38,
    bossDamage: 1.203,
    penetration: 0.38,
    trainingCorrection: 0.08,
    skillMultiplier: 1.0,
  };

  const excelProfile: Profile = {
    id: makeId("profile"),
    name: "siumai 進戰 (Excel)",
    note: "從 siumai 傷害 分頁匯入的基準數值（已含當前配裝）",
    damageType: "magic",
    base: statsFrom(base),
    equipped: {},
    itemIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const buffProfile: Profile = {
    id: makeId("profile"),
    name: "siumai 嗚滿 (Excel)",
    note: "食物 + 二覺等滿效果列，用於示範比較",
    damageType: "magic",
    base: statsFrom(fullBuff),
    equipped: {},
    itemIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const buildProfile: Profile = {
    id: makeId("profile"),
    name: "空白組裝檔",
    note: "從基底數值開始，自行選擇裝備與道具",
    damageType: "magic",
    base: statsFrom(bare),
    equipped: {},
    itemIds: [],
    createdAt: now,
    updatedAt: now,
  };

  return [excelProfile, buffProfile, buildProfile];
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const profiles = createDefaultProfiles();
      return {
        profiles,
        customEquipment: [],
        customItems: [],
        compareIds: profiles.map((p) => p.id).slice(0, 2),
        activeProfileId: profiles[0]?.id ?? null,
      };
    }
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.profiles)) throw new Error("bad profiles");
    return {
      profiles: parsed.profiles,
      customEquipment: parsed.customEquipment ?? [],
      customItems: parsed.customItems ?? [],
      compareIds: parsed.compareIds ?? [],
      activeProfileId: parsed.activeProfileId ?? parsed.profiles[0]?.id ?? null,
    };
  } catch {
    const profiles = createDefaultProfiles();
    return {
      profiles,
      customEquipment: [],
      customItems: [],
      compareIds: profiles.map((p) => p.id).slice(0, 2),
      activeProfileId: profiles[0]?.id ?? null,
    };
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profiles: state.profiles,
      customEquipment: state.customEquipment,
      customItems: state.customItems,
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
    equipped: {},
    itemIds: [],
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
