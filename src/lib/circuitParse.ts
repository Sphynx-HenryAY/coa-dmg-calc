import {
  CIRCUIT_BREAK_STATS,
  CIRCUIT_MAIN_STATS,
  CIRCUIT_PERCENT_STATS,
  CIRCUIT_SUB_STATS,
  formatAffix,
} from "./circuit";
import {
  circuitKindLabel,
  circuitStatLabel,
  m,
} from "./i18n";
import type { CircuitAffix, CircuitKind, CircuitStatKey } from "./types";

export type CircuitParseHit = {
  stat: CircuitStatKey;
  value: number;
  raw: number;
  hasPercent: boolean;
  index: number;
  label: string;
  section: ParseSection | null;
};

export type ParseSection = "main" | "sub" | "break";

export type CircuitParseResult = {
  kind: CircuitKind | null;
  name: string;
  main: CircuitAffix | null;
  subs: CircuitAffix[];
  breakthroughs: CircuitAffix[];
  hits: CircuitParseHit[];
  unmatched: string[];
  warnings: string[];
};

type AliasDef = {
  aliases: string[];
  stat: CircuitStatKey;
};

/** Longer / more specific names first so 技能傷害 wins over 傷害. */
const STAT_ALIAS_DEFS: AliasDef[] = [
  { stat: "elementalPower", aliases: ["全屬性強化", "全属性强化", "全屬性加强", "屬性強化", "属性强化", "Elem. Power", "Elemental Power"] },
  { stat: "allElementDamage", aliases: ["全屬性傷害", "全属性伤害", "All Elem. DMG", "All Element Damage"] },
  { stat: "circuitBoost", aliases: ["迴路增傷", "回路增傷", "迴路增伤", "回路增伤", "Circuit Boost"] },
  { stat: "skillDamage", aliases: ["技能傷害", "技能伤害", "技傷", "技伤", "Skill DMG", "Skill Damage"] },
  { stat: "damageBoost", aliases: ["傷害提升", "伤害提升", "提傷", "提伤", "DMG Boost", "Damage Boost"] },
  { stat: "bossDamage", aliases: ["頭目傷害", "头目伤害", "對頭目傷害", "对头目伤害", "對頭目", "对头目", "Boss DMG", "Boss Damage"] },
  { stat: "statusDamage", aliases: ["異常傷害", "异常伤害", "剋制異常", "克制异常", "Status DMG", "Status Damage"] },
  { stat: "strInt", aliases: ["力量智力", "力量與智力", "力量与智力", "STR/INT", "STR INT"] },
  { stat: "agiSpr", aliases: ["敏捷精神", "敏捷與精神", "敏捷与精神", "AGI/SPR", "AGI SPR"] },
  { stat: "critDamage", aliases: ["暴擊傷害", "暴击伤害", "爆擊傷害", "爆击伤害", "暴傷", "暴伤", "爆傷", "爆伤", "Crit DMG", "Crit Damage"] },
  { stat: "critRate", aliases: ["暴擊率", "暴击率", "爆擊率", "爆击率", "暴率", "Crit Rate"] },
  { stat: "atkSpeed", aliases: ["攻擊速度", "攻击速度", "攻速", "ATK Speed", "Attack Speed"] },
  { stat: "cooldown", aliases: ["冷卻速度", "冷却速度", "冷卻縮減", "冷却缩减", "冷卻", "冷却", "CDR", "Cooldown"] },
  { stat: "hp", aliases: ["最大生命值", "最大生命", "生命值", "生命", "Max HP", "HP"] },
  { stat: "pDef", aliases: ["物理防禦", "物理防御", "物防", "P.DEF", "Physical Defense"] },
  { stat: "mDef", aliases: ["魔法防禦", "魔法防御", "魔防", "M.DEF", "Magic Defense"] },
  { stat: "pAtk", aliases: ["物理攻擊力", "物理攻击力", "物理攻擊", "物理攻击", "物攻", "P.ATK", "Physical Attack"] },
  { stat: "mAtk", aliases: ["魔法攻擊力", "魔法攻击力", "魔法攻擊", "魔法攻击", "魔攻", "M.ATK", "Magic Attack"] },
  { stat: "attack", aliases: ["攻擊力", "攻击力", "ATK", "Attack"] },
  { stat: "int", aliases: ["智力", "INT", "Intelligence"] },
  { stat: "str", aliases: ["力量", "STR", "Strength"] },
  { stat: "vit", aliases: ["體質", "体质", "VIT", "Vitality"] },
  { stat: "agi", aliases: ["敏捷", "AGI", "Agility"] },
  { stat: "spr", aliases: ["精神", "SPR", "Spirit"] },
  { stat: "ice", aliases: ["冰屬性強化", "冰属性强化", "冰屬性", "冰属性", "冰屬", "冰属", "Ice"] },
  { stat: "fire", aliases: ["火屬性強化", "火属性强化", "火屬性", "火属性", "火屬", "火属", "Fire"] },
  {
    stat: "electric",
    aliases: ["電屬性強化", "电属性强化", "雷屬性強化", "電屬性", "电属性", "電屬", "电属", "雷屬", "雷属", "Lightning", "Electric"],
  },
  { stat: "dark", aliases: ["暗屬性強化", "暗属性强化", "暗屬性", "暗属性", "暗屬", "暗属", "Dark"] },
  { stat: "bossDamage", aliases: ["頭目", "头目", "Boss"] },
  { stat: "statusDamage", aliases: ["異常", "异常", "Status"] },
];

const KIND_ALIASES: Array<{ kind: CircuitKind; aliases: string[] }> = [
  { kind: "time", aliases: ["時間迴路", "时间回路", "時間", "时间", "Time Circuit", "Time"] },
  { kind: "nether", aliases: ["冥燈迴路", "冥灯回路", "冥燈", "冥灯", "Nether Circuit", "Nether"] },
  { kind: "star", aliases: ["星軌迴路", "星轨回路", "星軌", "星轨", "Star Circuit", "Star"] },
  { kind: "key", aliases: ["輝鑰迴路", "辉钥回路", "輝鑰", "辉钥", "Key Circuit", "Key"] },
];

const BREAK_ONLY = new Set<CircuitStatKey>([
  "circuitBoost",
  "allElementDamage",
  "elementalPower",
  "damageBoost",
  "bossDamage",
  "statusDamage",
  "strInt",
  "agiSpr",
]);

const SUB_SET = new Set<CircuitStatKey>(CIRCUIT_SUB_STATS);
const BREAK_SET = new Set<CircuitStatKey>(CIRCUIT_BREAK_STATS);

const SORTED_ALIASES = STAT_ALIAS_DEFS.flatMap((def) =>
  def.aliases.map((alias) => ({ alias, stat: def.stat })),
).sort((a, b) => b.alias.length - a.alias.length);

const SECTION_MARKERS: Array<{ re: RegExp; section: ParseSection }> = [
  { re: /突破屬性|突破属性|突破詞條|突破词条|突破|Breakthrough|(?:^|[\n\s])突[:：]/gi, section: "break" },
  { re: /副屬性|副属性|副詞條|副词条|Substat|Sub-stat|(?:^|[\n\s])副[:：]/gi, section: "sub" },
  { re: /主屬性|主属性|主詞條|主词条|Main stat|(?:^|[\n\s])主[:：]/gi, section: "main" },
];

const VALUE_AFTER =
  /^(?:[\s]*)(?:[+:：\-—–])?(?:[\s]*)([-+]?\d+(?:\.\d+)?)(?:\s*([%％]))?/;

export function normalizeCircuitScanText(raw: string): string {
  let text = raw
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/[＋﹢]/g, "+")
    .replace(/[％]/g, "%")
    .replace(/[。．]/g, ".")
    .replace(/[，]/g, "")
    .replace(/[oOｏＯ](?=\d)/g, "0")
    .replace(/(\d)[oOｏＯ]/g, "$10")
    .replace(/[|]/g, "1")
    .replace(/[–—]/g, "-");
  // Tesseract often inserts spaces between CJK glyphs.
  let prev = "";
  while (text !== prev) {
    prev = text;
    text = text.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2");
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ");
}

export function inferKindFromMain(stat: CircuitStatKey): CircuitKind | null {
  const kinds = (Object.keys(CIRCUIT_MAIN_STATS) as CircuitKind[]).filter((k) =>
    CIRCUIT_MAIN_STATS[k].includes(stat),
  );
  return kinds[0] ?? null;
}

export function parseCircuitText(
  raw: string,
  opts?: { kindHint?: CircuitKind | null },
): CircuitParseResult {
  const text = normalizeCircuitScanText(raw);
  const warnings: string[] = [];
  const kindFromText = detectKind(text);
  const kindHint = kindFromText ?? opts?.kindHint ?? null;
  const name = detectName(text, kindFromText);
  const sections = collectSections(text);
  const hits = extractHits(text, sections);

  if (hits.length === 0) {
    return {
      kind: kindFromText,
      name,
      main: null,
      subs: [],
      breakthroughs: [],
      hits,
      unmatched: nonemptyLines(text),
      warnings: text.trim() ? [m().parseNoHits] : [],
    };
  }

  const classified = classifyHits(hits, kindHint);

  if (
    classified.main &&
    classified.kind &&
    !CIRCUIT_MAIN_STATS[classified.kind].includes(classified.main.stat)
  ) {
    warnings.push(
      m().parseBadMain(
        circuitStatLabel(classified.main.stat),
        circuitKindLabel(classified.kind),
      ),
    );
  }

  for (const hit of hits) {
    if (CIRCUIT_PERCENT_STATS.has(hit.stat) && hit.raw > 80) {
      warnings.push(
        m().parseHigh(
          circuitStatLabel(hit.stat),
          `${hit.raw}${hit.hasPercent ? "%" : ""}`,
        ),
      );
    }
  }

  const unmatched = nonemptyLines(text).filter((line) => {
    if (isNoiseLine(line, classified.kind ?? kindFromText)) return false;
    return !hits.some((h) => line.includes(h.label));
  });

  return {
    kind: classified.kind,
    name,
    main: classified.main,
    subs: classified.subs,
    breakthroughs: classified.breakthroughs,
    hits,
    unmatched,
    warnings,
  };
}

export function parseResultLines(result: CircuitParseResult): string[] {
  const msg = m();
  const lines: string[] = [];
  if (result.kind) lines.push(msg.parseKind(circuitKindLabel(result.kind)));
  if (result.name) lines.push(msg.parseName(result.name));
  if (result.main) lines.push(`${msg.affixMain}${formatAffix(result.main)}`);
  for (const sub of result.subs) lines.push(`${msg.affixSub}${formatAffix(sub)}`);
  for (const br of result.breakthroughs) {
    lines.push(`${msg.affixBreak}${formatAffix(br)}`);
  }
  return lines;
}

export function hasParseableCircuit(result: CircuitParseResult): boolean {
  return Boolean(
    result.main || result.subs.length > 0 || result.breakthroughs.length > 0,
  );
}

function detectKind(text: string): CircuitKind | null {
  let best: { kind: CircuitKind; index: number; len: number } | null = null;
  for (const { kind, aliases } of KIND_ALIASES) {
    for (const alias of aliases) {
      const index = text.indexOf(alias);
      if (index < 0) continue;
      if (
        !best ||
        index < best.index ||
        (index === best.index && alias.length > best.len)
      ) {
        best = { kind, index, len: alias.length };
      }
    }
  }
  return best?.kind ?? null;
}

function detectName(text: string, kind: CircuitKind | null): string {
  const first = text.split(/\n/)[0]?.trim() ?? "";
  if (!first) return "";
  if (extractHits(first, []).length > 0) return "";
  let name = first;
  if (kind) {
    for (const alias of KIND_ALIASES.find((k) => k.kind === kind)?.aliases ?? []) {
      name = name.replace(alias, " ");
    }
  }
  name = name
    .replace(/迴路|回路/g, " ")
    .replace(/主屬性|主属性|副屬性|副属性|突破.*/g, " ")
    .replace(/[|:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length > 24) return "";
  if (/^\d+$/.test(name)) return "";
  return name;
}

function collectSections(text: string): Array<{ index: number; section: ParseSection }> {
  const found: Array<{ index: number; section: ParseSection }> = [];
  for (const { re, section } of SECTION_MARKERS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      found.push({ index: m.index, section });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

function sectionAt(
  index: number,
  sections: Array<{ index: number; section: ParseSection }>,
): ParseSection | null {
  let current: ParseSection | null = null;
  for (const s of sections) {
    if (s.index <= index) current = s.section;
    else break;
  }
  return current;
}

function extractHits(
  text: string,
  sections: Array<{ index: number; section: ParseSection }>,
): CircuitParseHit[] {
  const used: Array<[number, number]> = [];
  const hits: CircuitParseHit[] = [];

  for (const { alias, stat } of SORTED_ALIASES) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(alias, from);
      if (index < 0) break;
      const aliasEnd = index + alias.length;
      from = aliasEnd;
      if (overlaps(used, index, aliasEnd)) continue;

      const rest = text.slice(aliasEnd, aliasEnd + 32);
      const match = rest.match(VALUE_AFTER);
      if (!match || match[1] == null) continue;

      const consumedEnd = aliasEnd + match[0].length;
      if (overlaps(used, index, consumedEnd)) continue;

      let raw = Number(match[1]);
      if (!Number.isFinite(raw)) continue;
      const hasPercent = Boolean(match[2]);
      raw = maybeFixLeadingPlusAsFour(stat, raw);
      const value = toStoredValue(stat, raw, hasPercent);

      used.push([index, consumedEnd]);
      hits.push({
        stat,
        value,
        raw,
        hasPercent,
        index,
        label: alias,
        section: sectionAt(index, sections),
      });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

function classifyHits(
  hits: CircuitParseHit[],
  kindHint: CircuitKind | null,
): {
  kind: CircuitKind | null;
  main: CircuitAffix | null;
  subs: CircuitAffix[];
  breakthroughs: CircuitAffix[];
} {
  let kind = kindHint;
  if (!kind) {
    const firstMain = hits.find((h) => inferKindFromMain(h.stat));
    if (firstMain) kind = inferKindFromMain(firstMain.stat);
  }

  const mainHit =
    hits.find(
      (h) =>
        h.section === "main" &&
        (!kind || CIRCUIT_MAIN_STATS[kind].includes(h.stat)),
    ) ??
    hits.find((h) => (kind ? CIRCUIT_MAIN_STATS[kind].includes(h.stat) : false)) ??
    hits.find((h) => inferKindFromMain(h.stat)) ??
    null;

  if (!kind && mainHit) kind = inferKindFromMain(mainHit.stat);

  const seenSub = new Set<CircuitStatKey>();
  if (mainHit) seenSub.add(mainHit.stat);

  const subs: CircuitAffix[] = [];
  const breakthroughs: CircuitAffix[] = [];

  for (const hit of hits) {
    if (hit === mainHit) continue;

    if (hit.section === "break") {
      if (BREAK_SET.has(hit.stat) && breakthroughs.length < 4) {
        breakthroughs.push({ stat: hit.stat, value: hit.value });
      }
      continue;
    }

    if (hit.section === "sub") {
      if (SUB_SET.has(hit.stat) && !seenSub.has(hit.stat) && subs.length < 4) {
        seenSub.add(hit.stat);
        subs.push({ stat: hit.stat, value: hit.value });
      } else if (BREAK_SET.has(hit.stat) && breakthroughs.length < 4) {
        breakthroughs.push({ stat: hit.stat, value: hit.value });
      }
      continue;
    }

    if (BREAK_ONLY.has(hit.stat)) {
      if (breakthroughs.length < 4) {
        breakthroughs.push({ stat: hit.stat, value: hit.value });
      }
      continue;
    }

    if (SUB_SET.has(hit.stat) && !seenSub.has(hit.stat) && subs.length < 4) {
      seenSub.add(hit.stat);
      subs.push({ stat: hit.stat, value: hit.value });
      continue;
    }

    if (BREAK_SET.has(hit.stat) && breakthroughs.length < 4) {
      breakthroughs.push({ stat: hit.stat, value: hit.value });
    }
  }

  return {
    kind,
    main: mainHit ? { stat: mainHit.stat, value: mainHit.value } : null,
    subs,
    breakthroughs,
  };
}

function toStoredValue(stat: CircuitStatKey, raw: number, hasPercent: boolean): number {
  if (!CIRCUIT_PERCENT_STATS.has(stat)) return raw;
  if (hasPercent || Math.abs(raw) > 1.5) return raw / 100;
  return raw;
}

/**
 * OCR often reads "+" as "4" (e.g. 暴率412.5% → 412.5).
 * Only rewrite when the result would be an implausible percent.
 */
function maybeFixLeadingPlusAsFour(stat: CircuitStatKey, raw: number): number {
  if (!CIRCUIT_PERCENT_STATS.has(stat)) return raw;
  if (raw <= 80 || raw >= 500) return raw;
  const asText = String(raw);
  if (!asText.startsWith("4")) return raw;
  const rest = Number(asText.slice(1));
  if (Number.isFinite(rest) && rest > 0 && rest <= 80) return rest;
  return raw;
}

function overlaps(ranges: Array<[number, number]>, start: number, end: number): boolean {
  return ranges.some(([a, b]) => start < b && end > a);
}

function nonemptyLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function isNoiseLine(line: string, kind: CircuitKind | null): boolean {
  if (/^(主|副|突|突破|主屬性|副屬性|突破屬性|種類|名稱)[:：]?$/.test(line)) return true;
  if (kind && KIND_ALIASES.some((k) => k.kind === kind && k.aliases.some((a) => line === a))) {
    return true;
  }
  return /^(時間|冥燈|星軌|輝鑰|时间|冥灯|星轨|辉钥)$/.test(line);
}
