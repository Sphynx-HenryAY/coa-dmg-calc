import type {
  BuiltinProfessionId,
  CircuitElement,
  CircuitKind,
  CircuitStatKey,
  CombatStats,
  InsigniaRarity,
  InsigniaStatKey,
  ProfessionFamily,
  ProfessionId,
} from "./types";
import type enMessagesJson from "./locales/en.json";

export type Locale = string;

type MessageEntry = string | { tpl: string; args: string[] };

type ToMessage<T> = T extends string
  ? string
  : T extends { args: string[] }
    ? (...args: any[]) => string
    : never;

export type Messages = {
  [K in keyof (typeof enMessagesJson)["messages"]]: ToMessage<
    (typeof enMessagesJson)["messages"][K]
  >;
};

export interface Translations {
  meta: { htmlLang: string; label: string };
  statLabels: Record<keyof CombatStats, string>;
  circuitKind: Record<CircuitKind, string>;
  circuitElement: Record<CircuitElement | "all", string>;
  circuitStat: Record<CircuitStatKey, string>;
  insigniaRarity: Record<InsigniaRarity, string>;
  insigniaStat: Record<InsigniaStatKey, string>;
  slot: Record<string, string>;
  catalogStat: Record<string, string>;
  professionFamily: Record<ProfessionFamily, string>;
  professionName: Record<BuiltinProfessionId, string>;
  professionNote: Record<BuiltinProfessionId, string>;
  messages: Record<string, MessageEntry>;
}

const STORAGE_KEY = "coa-dmg-calc-locale";
const USER_LOCALES_KEY = "coa-dmg-calc-user-locales";

// Codes of locales the user imported and stored locally.
function userLocaleCodes(): string[] {
  try {
    const raw = localStorage.getItem(USER_LOCALES_KEY);
    if (raw) return Object.keys(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    /* ignore */
  }
  return [];
}

// Load every locale JSON in ./locales/ automatically.
// Adding a new language is just dropping a <code>.json file here.
const localeModules = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Translations>;

function localeFromPath(path: string): string {
  return path.replace(/^\.\/locales\//, "").replace(/\.json$/, "");
}

const globResources: Record<string, Translations> = {};
for (const [path, mod] of Object.entries(localeModules)) {
  globResources[localeFromPath(path)] = mod;
}

export const resources: Record<string, Translations> = { ...globResources };

function sortLocales(locales: string[]): string[] {
  const preferred = ["zh", "en"];
  return [...locales].sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    const ra = ia === -1 ? 1e9 : ia;
    const rb = ib === -1 ? 1e9 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

export const BUILTIN_LOCALES: string[] = sortLocales(Object.keys(globResources));

export const BASE_LOCALE: string = globResources["en"]
  ? "en"
  : BUILTIN_LOCALES[0];

export const DEFAULT_LOCALE: string = globResources["zh"]
  ? "zh"
  : BASE_LOCALE;

// Traditional Chinese is the preferred fail-over for any missing translation.
export const FALLBACK_LOCALE: string = globResources["zh"] ? "zh" : BASE_LOCALE;

export let SUPPORTED_LOCALES: string[] = [...BUILTIN_LOCALES];

// Pick the merge base for an imported locale: prefer traditional Chinese for
// Chinese variants, otherwise fall back to the base locale (en).
function fallbackBaseFor(code: string): Translations {
  if (code !== "zh" && globResources["zh"]) return globResources["zh"];
  return globResources[BASE_LOCALE];
}

function readStoredLocale(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (SUPPORTED_LOCALES.includes(raw) || userLocaleCodes().includes(raw)))
      return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function detectLocale(): string {
  const stored = readStoredLocale();
  if (stored) return stored;
  const nav =
    typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "";
  for (const loc of SUPPORTED_LOCALES) {
    if (loc === "zh" ? nav.startsWith("zh") : nav.startsWith(loc)) return loc;
  }
  return DEFAULT_LOCALE;
}

let currentLocale: string =
  typeof window !== "undefined" ? detectLocale() : DEFAULT_LOCALE;

export function getLocale(): string {
  return currentLocale;
}

function persistLocale(locale: string): void {
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function applyLocale(locale: string): void {
  persistLocale(locale);
}

function buildMessage(
  entry: MessageEntry,
): string | ((...args: any[]) => string) {
  if (typeof entry === "string") return entry;
  const { tpl, args } = entry;
  return (...params: any[]) => {
    const named: Record<string, any> = {};
    args.forEach((a, i) => (named[a] = params[i]));
    return tpl.replace(/\{(\w+)\}/g, (_m, k) =>
      k in named ? String(named[k]) : `{${k}}`,
    );
  };
}

export let messages: Record<string, Messages> = {};

function rebuildMessages(): void {
  const built: Record<string, Record<string, string | ((...args: any[]) => string)>> =
    {};
  for (const [loc, res] of Object.entries(resources)) {
    const b: Record<string, string | ((...args: any[]) => string)> = {};
    for (const [k, v] of Object.entries(res.messages)) {
      b[k] = buildMessage(v);
    }
    built[loc] = b;
  }
  messages = built as Record<string, Messages>;
}

export function getBaseTranslations(): Translations {
  return globResources[BASE_LOCALE];
}

export const LOCALE_CATEGORIES: (keyof Translations)[] = [
  "statLabels",
  "circuitKind",
  "circuitElement",
  "circuitStat",
  "insigniaRarity",
  "insigniaStat",
  "slot",
  "catalogStat",
  "professionFamily",
  "professionName",
  "professionNote",
];

export interface UserLocale {
  meta: { htmlLang: string; label: string };
  statLabels?: Record<string, string>;
  circuitKind?: Record<string, string>;
  circuitElement?: Record<string, string>;
  circuitStat?: Record<string, string>;
  insigniaRarity?: Record<string, string>;
  insigniaStat?: Record<string, string>;
  slot?: Record<string, string>;
  catalogStat?: Record<string, string>;
  professionFamily?: Record<string, string>;
  professionName?: Record<string, string>;
  professionNote?: Record<string, string>;
  messages: Record<string, string>;
}

function loadUserLocales(): Record<string, UserLocale> {
  try {
    const raw = localStorage.getItem(USER_LOCALES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, UserLocale>;
  } catch {
    /* ignore */
  }
  return {};
}

function userLocaleToTranslations(u: UserLocale, baseCode: string = BASE_LOCALE): Translations {
  const base = globResources[baseCode] ?? fallbackBaseFor(baseCode);
  const mergeMap = (cat: keyof Translations) =>
    ({
      ...(base[cat] as Record<string, string>),
      ...((u[cat as keyof UserLocale] as Record<string, string>) ?? {}),
    } as Record<string, string>);
  const msgs: Record<string, MessageEntry> = {};
  for (const [k, baseEntry] of Object.entries(base.messages)) {
    const uv = u.messages?.[k];
    if (uv != null && uv !== "") {
      if (typeof baseEntry === "object" && baseEntry && "tpl" in baseEntry) {
        msgs[k] = { tpl: String(uv), args: (baseEntry as { args: string[] }).args };
      } else {
        msgs[k] = String(uv);
      }
    } else {
      msgs[k] = baseEntry;
    }
  }
  return {
    meta: u.meta ?? base.meta,
    statLabels: mergeMap("statLabels"),
    circuitKind: mergeMap("circuitKind"),
    circuitElement: mergeMap("circuitElement"),
    circuitStat: mergeMap("circuitStat"),
    insigniaRarity: mergeMap("insigniaRarity"),
    insigniaStat: mergeMap("insigniaStat"),
    slot: mergeMap("slot"),
    catalogStat: mergeMap("catalogStat"),
    professionFamily: mergeMap("professionFamily"),
    professionName: mergeMap("professionName"),
    professionNote: mergeMap("professionNote"),
    messages: msgs,
  };
}

function rebuildAll(): void {
  const merged: Record<string, Translations> = { ...globResources };
  const user = loadUserLocales();
  for (const [code, u] of Object.entries(user)) {
    merged[code] = userLocaleToTranslations(u, code);
  }
  for (const k of Object.keys(resources)) delete resources[k];
  Object.assign(resources, merged);
  SUPPORTED_LOCALES = sortLocales(Object.keys(resources));
  rebuildMessages();
  rebuildLabelMaps();
}

export function getUserLocales(): Record<string, UserLocale> {
  return loadUserLocales();
}

export function isBuiltinLocale(code: string): boolean {
  return code in globResources;
}

export function saveUserLocale(code: string, data: UserLocale): void {
  const user = loadUserLocales();
  user[code] = data;
  try {
    localStorage.setItem(USER_LOCALES_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  rebuildAll();
}

export function deleteUserLocale(code: string): void {
  const user = loadUserLocales();
  delete user[code];
  try {
    localStorage.setItem(USER_LOCALES_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  rebuildAll();
}

export function localeToUserLocale(code: string): UserLocale {
  const r = resources[code] ?? globResources[BASE_LOCALE];
  const base = globResources[BASE_LOCALE];
  const toMsgStr = (k: string): string => {
    const e = r.messages[k];
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "tpl" in e) return (e as { tpl: string }).tpl;
    const be = base.messages[k];
    return typeof be === "string" ? be : (be as { tpl: string })?.tpl ?? "";
  };
  const map = (cat: keyof Translations) =>
    ({ ...(r[cat] as Record<string, string>) } as Record<string, string>);
  const messagesOut: Record<string, string> = {};
  for (const k of Object.keys(base.messages)) messagesOut[k] = toMsgStr(k);
  return {
    meta: { ...r.meta },
    statLabels: map("statLabels"),
    circuitKind: map("circuitKind"),
    circuitElement: map("circuitElement"),
    circuitStat: map("circuitStat"),
    insigniaRarity: map("insigniaRarity"),
    insigniaStat: map("insigniaStat"),
    slot: map("slot"),
    catalogStat: map("catalogStat"),
    professionFamily: map("professionFamily"),
    professionName: map("professionName"),
    professionNote: map("professionNote"),
    messages: messagesOut,
  };
}

export function translationsToUserLocale(t: Translations): UserLocale {
  const toMsgStr = (k: string): string => {
    const e = t.messages[k];
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "tpl" in e) return (e as { tpl: string }).tpl;
    return "";
  };
  const map = (cat: keyof Translations) =>
    ({ ...(t[cat] as Record<string, string>) } as Record<string, string>);
  const messagesOut: Record<string, string> = {};
  for (const k of Object.keys(t.messages)) messagesOut[k] = toMsgStr(k);
  return {
    meta: { ...t.meta },
    statLabels: map("statLabels"),
    circuitKind: map("circuitKind"),
    circuitElement: map("circuitElement"),
    circuitStat: map("circuitStat"),
    insigniaRarity: map("insigniaRarity"),
    insigniaStat: map("insigniaStat"),
    slot: map("slot"),
    catalogStat: map("catalogStat"),
    professionFamily: map("professionFamily"),
    professionName: map("professionName"),
    professionNote: map("professionNote"),
    messages: messagesOut,
  };
}

function buildLabelMap(key: keyof Translations): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const loc of SUPPORTED_LOCALES) {
    out[loc] = (resources[loc]?.[key] as Record<string, string>) ?? {};
  }
  return out;
}

export let STAT_LABELS_I18N = buildLabelMap("statLabels") as Record<
  Locale,
  Record<keyof CombatStats, string>
>;

export let CIRCUIT_KIND_LABELS = buildLabelMap("circuitKind") as Record<
  Locale,
  Record<CircuitKind, string>
>;

export let CIRCUIT_ELEMENT_LABELS = buildLabelMap("circuitElement") as Record<
  Locale,
  Record<CircuitElement | "all", string>
>;

export let CIRCUIT_STAT_LABELS = buildLabelMap("circuitStat") as Record<
  Locale,
  Record<CircuitStatKey, string>
>;

export let INSIGNIA_RARITY_LABELS = buildLabelMap("insigniaRarity") as Record<
  Locale,
  Record<InsigniaRarity, string>
>;

export let INSIGNIA_STAT_LABELS = buildLabelMap("insigniaStat") as Record<
  Locale,
  Record<InsigniaStatKey, string>
>;

export let SLOT_LABELS = buildLabelMap("slot") as Record<
  Locale,
  Record<string, string>
>;

export let CATALOG_STAT_LABELS = buildLabelMap("catalogStat") as Record<
  Locale,
  Record<string, string>
>;

export let PROFESSION_FAMILY_LABELS = buildLabelMap("professionFamily") as Record<
  Locale,
  Record<ProfessionFamily, string>
>;

export let PROFESSION_NAME_LABELS = buildLabelMap("professionName") as Record<
  Locale,
  Record<BuiltinProfessionId, string>
>;

export let PROFESSION_NOTE_LABELS = buildLabelMap("professionNote") as Record<
  Locale,
  Record<BuiltinProfessionId, string>
>;

// Rebuild the static label maps so newly added (e.g. imported) locales are
// included. Without this, lookups for an unknown locale throw and blank the app.
export function rebuildLabelMaps(): void {
  STAT_LABELS_I18N = buildLabelMap("statLabels") as Record<
    Locale,
    Record<keyof CombatStats, string>
  >;
  CIRCUIT_KIND_LABELS = buildLabelMap("circuitKind") as Record<
    Locale,
    Record<CircuitKind, string>
  >;
  CIRCUIT_ELEMENT_LABELS = buildLabelMap("circuitElement") as Record<
    Locale,
    Record<CircuitElement | "all", string>
  >;
  CIRCUIT_STAT_LABELS = buildLabelMap("circuitStat") as Record<
    Locale,
    Record<CircuitStatKey, string>
  >;
  INSIGNIA_RARITY_LABELS = buildLabelMap("insigniaRarity") as Record<
    Locale,
    Record<InsigniaRarity, string>
  >;
  INSIGNIA_STAT_LABELS = buildLabelMap("insigniaStat") as Record<
    Locale,
    Record<InsigniaStatKey, string>
  >;
  SLOT_LABELS = buildLabelMap("slot") as Record<Locale, Record<string, string>>;
  CATALOG_STAT_LABELS = buildLabelMap("catalogStat") as Record<
    Locale,
    Record<string, string>
  >;
  PROFESSION_FAMILY_LABELS = buildLabelMap("professionFamily") as Record<
    Locale,
    Record<ProfessionFamily, string>
  >;
  PROFESSION_NAME_LABELS = buildLabelMap("professionName") as Record<
    Locale,
    Record<BuiltinProfessionId, string>
  >;
  PROFESSION_NOTE_LABELS = buildLabelMap("professionNote") as Record<
    Locale,
    Record<BuiltinProfessionId, string>
  >;
}

export function slotLabel(slot: string, locale: Locale = getLocale()): string {
  return SLOT_LABELS[locale]?.[slot] ?? SLOT_LABELS[FALLBACK_LOCALE]?.[slot] ?? slot;
}

export function statLabel(key: keyof CombatStats, locale: Locale = getLocale()): string {
  return (
    STAT_LABELS_I18N[locale]?.[key] ??
    STAT_LABELS_I18N[FALLBACK_LOCALE]?.[key] ??
    String(key)
  );
}

export function circuitKindLabel(kind: CircuitKind, locale: Locale = getLocale()): string {
  return (
    CIRCUIT_KIND_LABELS[locale]?.[kind] ??
    CIRCUIT_KIND_LABELS[FALLBACK_LOCALE]?.[kind] ??
    String(kind)
  );
}

export function circuitElementLabel(
  el: CircuitElement | "all",
  locale: Locale = getLocale(),
): string {
  return (
    CIRCUIT_ELEMENT_LABELS[locale]?.[el] ??
    CIRCUIT_ELEMENT_LABELS[FALLBACK_LOCALE]?.[el] ??
    String(el)
  );
}

export function circuitStatLabel(
  key: CircuitStatKey,
  locale: Locale = getLocale(),
): string {
  return (
    CIRCUIT_STAT_LABELS[locale]?.[key] ??
    CIRCUIT_STAT_LABELS[FALLBACK_LOCALE]?.[key] ??
    String(key)
  );
}

export function insigniaRarityLabel(
  rarity: InsigniaRarity,
  locale: Locale = getLocale(),
): string {
  return (
    INSIGNIA_RARITY_LABELS[locale]?.[rarity] ??
    INSIGNIA_RARITY_LABELS[FALLBACK_LOCALE]?.[rarity] ??
    String(rarity)
  );
}

export function insigniaStatLabel(
  key: InsigniaStatKey,
  locale: Locale = getLocale(),
): string {
  return (
    INSIGNIA_STAT_LABELS[locale]?.[key] ??
    INSIGNIA_STAT_LABELS[FALLBACK_LOCALE]?.[key] ??
    String(key)
  );
}

export function catalogStatLabel(key: string, locale: Locale = getLocale()): string {
  return (
    CATALOG_STAT_LABELS[locale]?.[key] ??
    CATALOG_STAT_LABELS[FALLBACK_LOCALE]?.[key] ??
    key
  );
}

export function professionFamilyLabel(
  family: ProfessionFamily,
  locale: Locale = getLocale(),
): string {
  return (
    PROFESSION_FAMILY_LABELS[locale]?.[family] ??
    PROFESSION_FAMILY_LABELS[FALLBACK_LOCALE]?.[family] ??
    String(family)
  );
}

export function professionNameLabel(
  id: ProfessionId | null | undefined,
  locale: Locale = getLocale(),
  fallback?: string,
): string {
  if (!id) return fallback ?? "";
  const labeled =
    PROFESSION_NAME_LABELS[locale]?.[id as BuiltinProfessionId] ??
    PROFESSION_NAME_LABELS[FALLBACK_LOCALE]?.[id as BuiltinProfessionId];
  return labeled ?? fallback ?? id;
}

export function professionNoteLabel(
  id: ProfessionId | null | undefined,
  locale: Locale = getLocale(),
  fallback?: string,
): string {
  if (!id) return fallback ?? "";
  const labeled =
    PROFESSION_NOTE_LABELS[locale]?.[id as BuiltinProfessionId] ??
    PROFESSION_NOTE_LABELS[FALLBACK_LOCALE]?.[id as BuiltinProfessionId];
  return labeled ?? fallback ?? id;
}

rebuildAll();

export function m(): Messages {
  return (
    messages[getLocale()] ??
    messages[FALLBACK_LOCALE] ??
    messages[DEFAULT_LOCALE]
  );
}
