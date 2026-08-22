import type { CatalogItem, Equipment, StatBag } from "./types";
import { makeId } from "./damage";
import { catalogStatLabel } from "./i18n";

/** Label → stat key used by free-text / CSV stats fields. */
export const STAT_LABEL_TO_KEY: Record<string, keyof StatBag> = {
  攻擊: "attack",
  攻擊力: "attack",
  物攻: "physicalAttack",
  魔攻: "magicAttack",
  物理攻擊: "physicalAttack",
  魔法攻擊: "magicAttack",
  破防: "defenseBreak",
  暴率: "critRate",
  暴擊: "critRate",
  暴擊率: "critRate",
  物理暴擊率: "critRate",
  魔法暴擊率: "critRateMagic",
  爆傷: "critDamage",
  暴擊傷害: "critDamage",
  屬強: "elementalPower",
  全屬性強化: "elementalPower",
  技傷: "skillDamage",
  技能傷害: "skillDamage",
  共鳴: "resonance",
  共鳴期間傷害: "resonance",
  提傷: "damageBoost",
  傷害提升: "damageBoost",
  迴路增傷: "circuitBoost",
  全屬性傷害: "allElementDamage",
  附加傷害: "additionalDamage",
  異常: "statusDamage",
  剋制異常敵人: "statusDamage",
  頭目: "bossDamage",
  對頭目傷害: "bossDamage",
  穿透: "penetration",
  物理穿透: "penetration",
  魔法穿透: "penetrationMagic",
  攻擊百分比: "attackPercent",
  物理攻擊力: "attackPercent",
  魔法攻擊力: "attackPercentMagic",
  智力: "intPercent",
  力量: "strPercent",
  普攻傷害: "normalAttackDamage",
  訓練場修正: "trainingCorrection",
  技能倍率: "skillMultiplier",
  攻速: "attackSpeed",
  冷卻速度: "cooldownSpeed",
  共鳴充能效率: "resonanceCharge",
  Attack: "attack",
  ATK: "attack",
  "P.ATK": "physicalAttack",
  "Physical Attack": "physicalAttack",
  "M.ATK": "magicAttack",
  "Magic Attack": "magicAttack",
  "DEF Break": "defenseBreak",
  "Defense Break": "defenseBreak",
  "Crit Rate": "critRate",
  Crit: "critRate",
  "Magic Crit Rate": "critRateMagic",
  "Crit DMG": "critDamage",
  "Crit Damage": "critDamage",
  "Elem. Power": "elementalPower",
  "Elemental Power": "elementalPower",
  "All Element Enhance": "elementalPower",
  "Skill DMG": "skillDamage",
  "Skill Damage": "skillDamage",
  Resonance: "resonance",
  "DMG Boost": "damageBoost",
  "Damage Boost": "damageBoost",
  "Circuit Boost": "circuitBoost",
  "All Elem. DMG": "allElementDamage",
  "All Element Damage": "allElementDamage",
  "Bonus DMG": "additionalDamage",
  "Additional Damage": "additionalDamage",
  Status: "statusDamage",
  "Status Damage": "statusDamage",
  Boss: "bossDamage",
  "Boss Damage": "bossDamage",
  Penetration: "penetration",
  "Magic Pen": "penetrationMagic",
  "Magic Penetration": "penetrationMagic",
  "ATK%": "attackPercent",
  "P.ATK%": "attackPercent",
  "M.ATK%": "attackPercentMagic",
  INT: "intPercent",
  Intelligence: "intPercent",
  STR: "strPercent",
  Strength: "strPercent",
  "Normal ATK DMG": "normalAttackDamage",
  "Normal Attack Damage": "normalAttackDamage",
  "Training Corr.": "trainingCorrection",
  "Training Correction": "trainingCorrection",
  "Skill Mult.": "skillMultiplier",
  "Skill Multiplier": "skillMultiplier",
  "ATK Speed": "attackSpeed",
  CDR: "cooldownSpeed",
  Cooldown: "cooldownSpeed",
  "Resonance Charge": "resonanceCharge",
};

const STAT_LABEL_LOOKUP_LOWER: Record<string, keyof StatBag> = Object.fromEntries(
  Object.entries(STAT_LABEL_TO_KEY).map(([label, key]) => [label.toLowerCase(), key]),
);

const KEY_TO_LABEL: Partial<Record<keyof StatBag, string>> = {
  attack: "攻擊力",
  physicalAttack: "物攻",
  magicAttack: "魔攻",
  defenseBreak: "破防",
  critRate: "暴率",
  critRateMagic: "魔法暴擊率",
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
  penetrationMagic: "魔法穿透",
  attackPercent: "物理攻擊力",
  attackPercentMagic: "魔法攻擊力",
  intPercent: "智力",
  strPercent: "力量",
  normalAttackDamage: "普攻傷害",
  trainingCorrection: "訓練場修正",
  skillMultiplier: "技能倍率",
  attackSpeed: "攻速",
  cooldownSpeed: "冷卻速度",
  resonanceCharge: "共鳴充能效率",
};

const FLAT_KEYS = new Set<keyof StatBag>([
  "attack",
  "physicalAttack",
  "magicAttack",
  "defenseBreak",
  "elementalPower",
  "skillMultiplier",
  "attackSpeed",
  "cooldownSpeed",
]);

export function parseStatLines(text: string): { stats: StatBag; lines: string[] } {
  const stats: StatBag = {};
  const lines: string[] = [];

  for (const rawLine of text.split(/\n|;|；|\|/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(.+?)\s*[+:：]?\s*([-+]?[\d.]+)\s*(%|％)?$/);
    if (!m) continue;
    const label = m[1].trim().replace(/%$/, "");
    const num = Number(m[2]);
    const isPct = Boolean(m[3]);
    const normalized = label.replace(/\s+/g, " ");
    const key =
      STAT_LABEL_TO_KEY[normalized] ??
      STAT_LABEL_TO_KEY[normalized.toLowerCase()] ??
      STAT_LABEL_LOOKUP_LOWER[normalized.toLowerCase()];
    if (!key || !Number.isFinite(num)) continue;

    let value = num;
    if (isPct) {
      value = num / 100;
    } else if (!FLAT_KEYS.has(key) && Math.abs(num) > 1.5) {
      value = num / 100;
    }

    const prev = (stats[key] as number | undefined) ?? 0;
    (stats as Record<string, number>)[key] = prev + value;
    lines.push(line);
  }
  return { stats, lines };
}

export function statsToText(stats: StatBag, fallbackLines?: string[]): string {
  if (fallbackLines && fallbackLines.length > 0) {
    const joined = fallbackLines.filter((l) => l && !l.includes("無解析")).join("\n");
    if (joined) return joined;
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(stats) as Array<[keyof StatBag, number]>) {
    if (value == null || !Number.isFinite(value) || value === 0) continue;
    const label = catalogStatLabel(String(key)) || KEY_TO_LABEL[key] || String(key);
    if (FLAT_KEYS.has(key)) {
      parts.push(`${label} +${trimNum(value)}`);
    } else {
      parts.push(`${label} +${trimNum(value * 100)}%`);
    }
  }
  return parts.join("\n");
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

export function mergeCatalog<T extends { id: string }>(
  demo: T[],
  custom: T[],
  hiddenIds: string[],
): T[] {
  const hidden = new Set(hiddenIds);
  const customMap = new Map(custom.map((c) => [c.id, c]));
  const out: T[] = [];

  for (const d of demo) {
    if (hidden.has(d.id)) continue;
    const override = customMap.get(d.id);
    if (override) {
      out.push(override);
      customMap.delete(d.id);
    } else {
      out.push(d);
    }
  }
  for (const c of customMap.values()) {
    if (!hidden.has(c.id)) out.push(c);
  }
  return out;
}

/* ── CSV helpers ─────────────────────────────────────────────── */

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
}

export const GEAR_CSV_TEMPLATE = [
  "id,name,slot,set,stats,effects",
  ',示例項鍊,項鍊,自訂,"技能傷害 +12%;全屬性強化 +28;對頭目傷害 +11%",',
  ',示例腕帶,腕帶,思芒爍影,"物理暴擊率 +6%;魔法暴擊率 +6%;對頭目傷害 +11%;全屬性強化 +20",',
  ',示例戒指,戒指,湮滅崩解,"傷害提升 +15%;暴擊傷害 +24%;物理穿透 +8%",',
].join("\n") + "\n";

export const ITEM_CSV_TEMPLATE = [
  "id,name,stats",
  ',銘刻 全屬性傷害,"全屬性傷害 +17%"',
  ',熱水器 附加傷害,"附加傷害 +8.8%"',
  ',自訂 Buff,"屬強 +20;異常 +5%;提傷 +10%"',
].join("\n") + "\n";

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  // BOM helps Excel open UTF-8 Chinese correctly
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function equipmentToCsv(list: Equipment[]): string {
  const header = "id,name,slot,set,stats,effects";
  const lines = list.map((e) =>
    [
      e.id,
      e.name,
      e.slot,
      e.set ?? "",
      statsToText(e.stats, e.statLines).replace(/\n/g, ";"),
      (e.effects ?? []).join(" | "),
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

export function itemsToCsv(list: CatalogItem[]): string {
  const header = "id,name,stats";
  const lines = list.map((item) =>
    [
      item.id,
      item.name,
      statsToText(item.stats, item.statLines).replace(/\n/g, ";"),
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

export type GearImportResult = {
  created: Equipment[];
  updated: Equipment[];
  errors: string[];
};

export type ItemImportResult = {
  created: CatalogItem[];
  updated: CatalogItem[];
  errors: string[];
};

export function importEquipmentCsv(
  text: string,
  existing: Equipment[],
): GearImportResult {
  const rows = rowsToObjects(parseCsv(text));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const created: Equipment[] = [];
  const updated: Equipment[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const lineNo = idx + 2;
    const name = row.name ?? row["名稱"] ?? "";
    const slot = row.slot ?? row["部位"] ?? "";
    if (!name.trim()) {
      errors.push(`第 ${lineNo} 行：缺少 name`);
      return;
    }
    if (!slot.trim()) {
      errors.push(`第 ${lineNo} 行「${name}」：缺少 slot`);
      return;
    }
    const statsRaw = row.stats ?? row["屬性"] ?? "";
    const { stats, lines } = parseStatLines(statsRaw.replace(/\|/g, ";"));
    const effectsRaw = row.effects ?? row["特效"] ?? "";
    const effects = effectsRaw
      ? effectsRaw.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
      : [];
    const id = (row.id ?? "").trim();
    const set = (row.set ?? row["套裝"] ?? "匯入").trim() || "匯入";

    if (id && byId.has(id)) {
      const prev = byId.get(id)!;
      updated.push({
        ...prev,
        name: name.trim(),
        slot: slot.trim(),
        set,
        stats,
        statLines: lines.length ? lines : prev.statLines,
        effects: effects.length ? effects : prev.effects,
        demo: false,
        source: prev.source === "acc set" || prev.source === "裝備" ? "custom-override" : "custom",
      });
    } else {
      created.push({
        id: id || makeId("gear"),
        name: name.trim(),
        slot: slot.trim(),
        set,
        stats,
        statLines: lines.length ? lines : ["（無解析到的數值）"],
        effects,
        demo: false,
        source: "import",
      });
    }
  });

  return { created, updated, errors };
}

export function importItemsCsv(
  text: string,
  existing: CatalogItem[],
): ItemImportResult {
  const rows = rowsToObjects(parseCsv(text));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const created: CatalogItem[] = [];
  const updated: CatalogItem[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const lineNo = idx + 2;
    const name = row.name ?? row["名稱"] ?? "";
    if (!name.trim()) {
      errors.push(`第 ${lineNo} 行：缺少 name`);
      return;
    }
    const statsRaw = row.stats ?? row["屬性"] ?? "";
    const { stats, lines } = parseStatLines(statsRaw.replace(/\|/g, ";"));
    const id = (row.id ?? "").trim();

    if (id && byId.has(id)) {
      const prev = byId.get(id)!;
      updated.push({
        ...prev,
        name: name.trim(),
        stats,
        statLines: lines.length ? lines : prev.statLines,
        demo: false,
      });
    } else {
      created.push({
        id: id || makeId("item"),
        name: name.trim(),
        kind: "item",
        stats,
        statLines: lines.length ? lines : ["（無解析到的數值）"],
        demo: false,
      });
    }
  });

  return { created, updated, errors };
}

/** Apply import: upsert into custom list (overrides demos by id). */
export function applyEquipmentImport(
  custom: Equipment[],
  result: GearImportResult,
): Equipment[] {
  const map = new Map(custom.map((e) => [e.id, e]));
  // created first, then updated so updates win on id collision
  for (const c of result.created) map.set(c.id, c);
  for (const u of result.updated) map.set(u.id, u);
  return [...map.values()];
}

export function applyItemImport(
  custom: CatalogItem[],
  result: ItemImportResult,
): CatalogItem[] {
  const map = new Map(custom.map((e) => [e.id, e]));
  for (const c of result.created) map.set(c.id, c);
  for (const u of result.updated) map.set(u.id, u);
  return [...map.values()];
}
