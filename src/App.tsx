import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import demoData from "./data/demoData.json";
import {
  GEAR_CSV_TEMPLATE,
  ITEM_CSV_TEMPLATE,
  applyEquipmentImport,
  applyItemImport,
  downloadText,
  equipmentToCsv,
  importEquipmentCsv,
  importItemsCsv,
  itemsToCsv,
  mergeCatalog,
  parseStatLines,
  statsToText,
} from "./lib/catalog";
import {
  PERCENT_STATS,
  STAT_LABELS,
  bagToStatBonuses,
  calculateDamage,
  formatDamage,
  formatRatio,
  formatSignedStatValue,
  formatStatValue,
  makeId,
  mergeStatBags,
  resolveEffectiveStats,
  TRAINING_DUMMY_DEF,
} from "./lib/damage";
import type {
  CatalogItem,
  CircuitElement,
  CircuitPiece,
  CircuitScheme,
  CombatStats,
  Equipment,
  InsigniaPiece,
  InsigniaScheme,
  ProfessionDef,
  ProfessionOverride,
  Profile,
  StatBag,
} from "./lib/types";
import {
  configCompareDamage,
  parseObservedDamage,
  rankConfigDamage,
} from "./lib/compare";
import {
  applyProfessionCycle,
  findProfession,
  listProfessions,
  normalizeCustomProfession,
  normalizeProfessionOverride,
  resolveProfession,
  resolvedCycleMultiplier,
  upsertProfessionOverride,
} from "./lib/profession";
import {
  EQUIPMENT_SLOTS,
  blankProfile,
  getDemoEquipment,
  getDemoItems,
  hasStoredState,
  loadState,
  saveState,
} from "./lib/storage";
import { CircuitTab } from "./components/CircuitTab";
import { InsigniaTab } from "./components/InsigniaTab";
import { ProfessionTab } from "./components/ProfessionTab";
import { ProfileSchemeShareBox } from "./components/SchemeShareBox";
import {
  contributionLines,
  equippedCount,
  schemeContribution,
} from "./lib/circuit";
import {
  compareSchemeInsignias,
  contributionLines as insigniaContributionLines,
  defaultInsigniaName,
  equippedCount as insigniaEquippedCount,
  schemeContribution as insigniaSchemeContribution,
} from "./lib/insignia";
import {
  SHARE_URL_WARN_LENGTH,
  buildNumericSharePayload,
  buildSharePayload,
  buildShareUrl,
  clearShareHash,
  decodeShareFragment,
  encodeShareFragment,
  prepareShareImport,
} from "./lib/share";
import {
  decodeCircuitSchemeCode,
  decodeInsigniaSchemeCode,
  encodeCircuitSchemeCode,
  encodeInsigniaSchemeCode,
  finalizeCircuitSchemeImport,
  finalizeInsigniaSchemeImport,
  peekSchemeShareKind,
  type CircuitSchemeBundle,
  type InsigniaSchemeBundle,
} from "./lib/schemeShare";
import {
  circuitElementLabel,
  insigniaRarityLabel,
  m as i18nMsg,
  professionNameLabel,
  slotLabel,
  statLabel,
} from "./lib/i18n";
import { useI18n } from "./lib/I18nProvider";

/** Stats that schemes can add but are not in the editable base form. */
const SCHEME_EXTRA_FIELDS: Array<keyof CombatStats> = [
  "physicalAttack",
  "magicAttack",
  "attackPercent",
  "normalAttackDamage",
];

const BASE_FIELDS: Array<{ key: keyof CombatStats; step?: string }> = [
  { key: "attack" },
  { key: "defenseBreak" },
  // Percent fields: UI shows 0–100+ scale; stored as 0–1+ fractions.
  { key: "critRate", step: "0.1" },
  { key: "critDamage", step: "0.1" },
  { key: "elementalPower", step: "0.1" },
  { key: "skillDamage", step: "0.1" },
  { key: "resonance", step: "0.1" },
  { key: "damageBoost", step: "0.1" },
  { key: "circuitBoost", step: "0.1" },
  { key: "allElementDamage", step: "0.1" },
  { key: "additionalDamage", step: "0.1" },
  { key: "statusDamage", step: "0.1" },
  { key: "bossDamage", step: "0.1" },
  { key: "penetration", step: "0.1" },
  { key: "trainingCorrection", step: "0.1" },
  { key: "skillMultiplier", step: "0.01" },
];

/** Display value for base-stat inputs (percent stats as 0–100 scale). */
function baseStatInputValue(key: keyof CombatStats, stored: number): number {
  if (!Number.isFinite(stored)) return 0;
  if (PERCENT_STATS.has(key)) {
    // Avoid long float noise like 49.999999999
    return Math.round(stored * 10000) / 100;
  }
  return stored;
}

function monsterDefs() {
  const msg = i18nMsg();
  return [
    { label: msg.monsterTraining(TRAINING_DUMMY_DEF), value: TRAINING_DUMMY_DEF },
    { label: msg.monsterLow, value: 5000 },
    { label: msg.monsterMid, value: 20000 },
    { label: msg.monsterHigh, value: 60000 },
  ];
}

type Tab =
  | "profiles"
  | "gear"
  | "items"
  | "circuits"
  | "insignias"
  | "professions"
  | "compare";

function App() {
  const { locale, setLocale, m } = useI18n();
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customEquipment, setCustomEquipment] = useState<Equipment[]>([]);
  const [customItems, setCustomItems] = useState<CatalogItem[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profiles");
  const [monsterDef, setMonsterDef] = useState(14000);
  const [status, setStatus] = useState("");
  const [gearFilter, setGearFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("");
  const [hiddenEquipmentIds, setHiddenEquipmentIds] = useState<string[]>([]);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [circuits, setCircuits] = useState<CircuitPiece[]>([]);
  const [circuitSchemes, setCircuitSchemes] = useState<CircuitScheme[]>([]);
  const [insignias, setInsignias] = useState<InsigniaPiece[]>([]);
  const [insigniaSchemes, setInsigniaSchemes] = useState<InsigniaScheme[]>([]);
  const [professionOverrides, setProfessionOverrides] = useState<
    ProfessionOverride[]
  >([]);
  const [customProfessions, setCustomProfessions] = useState<ProfessionDef[]>(
    [],
  );
  const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // gear form (create / edit)
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [gearName, setGearName] = useState("");
  const [gearSlot, setGearSlot] = useState("項鍊");
  const [gearSet, setGearSet] = useState(() => i18nMsg().customDefault);
  const [gearStats, setGearStats] = useState("");
  const [gearEffects, setGearEffects] = useState("");

  // item form (create / edit)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemStats, setItemStats] = useState("");

  const gearImportRef = useRef<HTMLInputElement>(null);
  const itemImportRef = useRef<HTMLInputElement>(null);
  const editorPanelRef = useRef<HTMLElement>(null);

  const demoEquipment = useMemo(() => getDemoEquipment(), []);
  const demoItems = useMemo(() => getDemoItems(), []);

  const allEquipment = useMemo(
    () => mergeCatalog(demoEquipment, customEquipment, hiddenEquipmentIds),
    [demoEquipment, customEquipment, hiddenEquipmentIds],
  );
  const allItems = useMemo(
    () => mergeCatalog(demoItems, customItems, hiddenItemIds),
    [demoItems, customItems, hiddenItemIds],
  );

  const equipmentById = useMemo(() => {
    const map = new Map<string, Equipment>();
    for (const e of allEquipment) map.set(e.id, e);
    return map;
  }, [allEquipment]);

  const itemsById = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const i of allItems) map.set(i.id, i);
    return map;
  }, [allItems]);

  const circuitsById = useMemo(() => {
    const map = new Map<string, CircuitPiece>();
    for (const c of circuits) map.set(c.id, c);
    return map;
  }, [circuits]);

  const schemesById = useMemo(() => {
    const map = new Map<string, CircuitScheme>();
    for (const s of circuitSchemes) map.set(s.id, s);
    return map;
  }, [circuitSchemes]);

  const insigniasById = useMemo(() => {
    const map = new Map<string, InsigniaPiece>();
    for (const p of insignias) map.set(p.id, p);
    return map;
  }, [insignias]);

  const insigniaSchemesById = useMemo(() => {
    const map = new Map<string, InsigniaScheme>();
    for (const s of insigniaSchemes) map.set(s.id, s);
    return map;
  }, [insigniaSchemes]);

  useEffect(() => {
    if (!ready) return;
    const valid = new Set(circuitSchemes.map((s) => s.id));
    setProfiles((list) => {
      let changed = false;
      const next = list.map((p) => {
        if (p.circuitSchemeId && !valid.has(p.circuitSchemeId)) {
          changed = true;
          return { ...p, circuitSchemeId: null };
        }
        return p;
      });
      return changed ? next : list;
    });
  }, [ready, circuitSchemes]);

  useEffect(() => {
    if (!ready) return;
    const valid = new Set(insigniaSchemes.map((s) => s.id));
    setProfiles((list) => {
      let changed = false;
      const next = list.map((p) => {
        if (p.insigniaSchemeId && !valid.has(p.insigniaSchemeId)) {
          changed = true;
          return { ...p, insigniaSchemeId: null };
        }
        return p;
      });
      return changed ? next : list;
    });
  }, [ready, insigniaSchemes]);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      const hadStore = hasStoredState();
      const state = loadState();
      let nextProfiles = state.profiles;
      let nextCustomEquipment = state.customEquipment;
      let nextCustomItems = state.customItems;
      let nextHiddenEquipmentIds = state.hiddenEquipmentIds;
      let nextHiddenItemIds = state.hiddenItemIds;
      let nextCircuits = state.circuits;
      let nextCircuitSchemes = state.circuitSchemes;
      let nextInsignias = state.insignias;
      let nextInsigniaSchemes = state.insigniaSchemes;
      let nextProfessionOverrides = state.professionOverrides;
      let nextCustomProfessions = state.customProfessions;
      let nextCompareIds = state.compareIds;
      let nextActiveProfileId = state.activeProfileId;
      let bootStatus = "";

      const hash = window.location.hash;
      if (hash && hash.length > 2) {
        const payload = await decodeShareFragment(hash);
        if (payload) {
          // Fresh visit via share link: only the shared profile (skip demo defaults).
          // Existing local data: merge the shared profile in without replacing others.
          if (!hadStore) {
            nextProfiles = [];
            nextCustomEquipment = [];
            nextCustomItems = [];
            nextHiddenEquipmentIds = [];
            nextHiddenItemIds = [];
            nextCircuits = [];
            nextCircuitSchemes = [];
            nextInsignias = [];
            nextInsigniaSchemes = [];
            nextProfessionOverrides = [];
            nextCustomProfessions = [];
            nextCompareIds = [];
            nextActiveProfileId = null;
          }

          const demoEq = getDemoEquipment();
          const demoIt = getDemoItems();
          const knownEq = new Set([
            ...demoEq.map((e) => e.id),
            ...nextCustomEquipment.map((e) => e.id),
          ]);
          const knownItems = new Set([
            ...demoIt.map((i) => i.id),
            ...nextCustomItems.map((i) => i.id),
          ]);
          const imported = prepareShareImport(
            payload,
            knownEq,
            knownItems,
            new Set(nextHiddenEquipmentIds),
            new Set(nextHiddenItemIds),
            nextProfiles,
            new Set(nextCircuits.map((c) => c.id)),
            new Set(nextCircuitSchemes.map((s) => s.id)),
            new Set(nextInsignias.map((p) => p.id)),
            new Set(nextInsigniaSchemes.map((s) => s.id)),
          );

          if (imported.equipmentToAdd.length) {
            nextCustomEquipment = [
              ...imported.equipmentToAdd,
              ...nextCustomEquipment,
            ];
          }
          if (imported.itemsToAdd.length) {
            nextCustomItems = [...imported.itemsToAdd, ...nextCustomItems];
          }
          if (imported.unhideEquipmentIds.length) {
            const unhide = new Set(imported.unhideEquipmentIds);
            nextHiddenEquipmentIds = nextHiddenEquipmentIds.filter(
              (id) => !unhide.has(id),
            );
          }
          if (imported.unhideItemIds.length) {
            const unhide = new Set(imported.unhideItemIds);
            nextHiddenItemIds = nextHiddenItemIds.filter((id) => !unhide.has(id));
          }
          if (imported.circuitsToAdd.length) {
            nextCircuits = [...imported.circuitsToAdd, ...nextCircuits];
          }
          if (imported.schemesToAdd.length) {
            nextCircuitSchemes = [...imported.schemesToAdd, ...nextCircuitSchemes];
          }
          if (imported.insigniasToAdd.length) {
            nextInsignias = [...imported.insigniasToAdd, ...nextInsignias];
          }
          if (imported.insigniaSchemesToAdd.length) {
            nextInsigniaSchemes = [
              ...imported.insigniaSchemesToAdd,
              ...nextInsigniaSchemes,
            ];
          }

          const newProfiles = imported.profiles;
          const resolved = imported.resolvedProfiles;
          if (resolved.length === 0) {
            // nothing usable in the share payload
          } else {
            if (newProfiles.length > 0) {
              nextProfiles = [...newProfiles, ...nextProfiles];
            }
            nextActiveProfileId = resolved[0]!.id;
            const resolvedIds = resolved.map((p) => p.id);
            nextCompareIds = hadStore
              ? [
                  ...resolvedIds,
                  ...nextCompareIds.filter((id) => !resolvedIds.includes(id)),
                ].slice(0, 5)
              : resolvedIds.slice(0, 5);

            const skipped = imported.skippedDuplicates;
            if (newProfiles.length === 0) {
              bootStatus =
                resolved.length === 1
                  ? i18nMsg().shareExistsOne(resolved[0]!.name)
                  : i18nMsg().shareExistsMany(resolved.length);
            } else if (skipped === 0) {
              bootStatus =
                newProfiles.length === 1
                  ? i18nMsg().shareImportedOne(newProfiles[0]!.name)
                  : i18nMsg().shareImportedMany(newProfiles.length);
            } else {
              bootStatus = i18nMsg().shareImportedPartial(newProfiles.length, skipped);
            }
            clearShareHash();
          }
        }
      }

      if (cancelled) return;
      setProfiles(nextProfiles);
      setCustomEquipment(nextCustomEquipment);
      setCustomItems(nextCustomItems);
      setHiddenEquipmentIds(nextHiddenEquipmentIds);
      setHiddenItemIds(nextHiddenItemIds);
      setCircuits(nextCircuits);
      setCircuitSchemes(nextCircuitSchemes);
      setInsignias(nextInsignias);
      setInsigniaSchemes(nextInsigniaSchemes);
      setProfessionOverrides(nextProfessionOverrides);
      setCustomProfessions(nextCustomProfessions);
      setCompareIds(nextCompareIds);
      setActiveProfileId(nextActiveProfileId);
      if (bootStatus) setStatus(bootStatus);
      setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState({
      profiles,
      customEquipment,
      customItems,
      hiddenEquipmentIds,
      hiddenItemIds,
      circuits,
      circuitSchemes,
      insignias,
      insigniaSchemes,
      professionOverrides,
      customProfessions,
      compareIds,
      activeProfileId,
    });
  }, [
    ready,
    profiles,
    customEquipment,
    customItems,
    hiddenEquipmentIds,
    hiddenItemIds,
    circuits,
    circuitSchemes,
    insignias,
    insigniaSchemes,
    professionOverrides,
    customProfessions,
    compareIds,
    activeProfileId,
  ]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  function updateProfile(id: string, patch: Partial<Profile>): void {
    setProfiles((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  }

  function updateBaseStat(key: keyof CombatStats, raw: string): void {
    if (!activeProfile) return;
    let value = Number(raw);
    if (!Number.isFinite(value)) return;
    // Percent inputs are entered as 12.5 meaning 12.5% → store 0.125
    if (PERCENT_STATS.has(key)) value = value / 100;
    updateProfile(activeProfile.id, {
      base: { ...activeProfile.base, [key]: value },
    });
  }

  function equipSlot(slot: string, equipmentId: string | null): void {
    if (!activeProfile) return;
    updateProfile(activeProfile.id, {
      equipped: { ...activeProfile.equipped, [slot]: equipmentId },
    });
  }

  function toggleItem(itemId: string): void {
    if (!activeProfile) return;
    const has = activeProfile.itemIds.includes(itemId);
    updateProfile(activeProfile.id, {
      itemIds: has
        ? activeProfile.itemIds.filter((id) => id !== itemId)
        : [...activeProfile.itemIds, itemId],
    });
  }

  function profileResult(
    profile: Profile,
    schemeOverride?: CircuitScheme | null,
    insigniaOverride?: InsigniaScheme | null,
    extraProfessionOverrides?: ProfessionOverride[],
  ) {
    const bags: StatBag[] = [];
    for (const eqId of Object.values(profile.equipped)) {
      if (!eqId) continue;
      const eq = equipmentById.get(eqId);
      if (eq) bags.push(eq.stats);
    }
    for (const itemId of profile.itemIds) {
      const item = itemsById.get(itemId);
      if (item) bags.push(item.stats);
    }
    const scheme =
      schemeOverride !== undefined
        ? schemeOverride
        : profile.circuitSchemeId
          ? (schemesById.get(profile.circuitSchemeId) ?? null)
          : null;
    if (scheme) {
      bags.push(
        schemeContribution(
          scheme,
          circuitsById,
          profile.element ?? "all",
          profile.damageType,
        ).bag,
      );
    }
    const insigniaScheme =
      insigniaOverride !== undefined
        ? insigniaOverride
        : profile.insigniaSchemeId
          ? (insigniaSchemesById.get(profile.insigniaSchemeId) ?? null)
          : null;
    if (insigniaScheme) {
      bags.push(
        insigniaSchemeContribution(
          insigniaScheme,
          insigniasById,
          profile.element ?? "all",
        ).bag,
      );
    }
    let overridesForResolve = professionOverrides;
    if (extraProfessionOverrides?.length) {
      overridesForResolve = professionOverrides;
      for (const patch of extraProfessionOverrides) {
        overridesForResolve = upsertProfessionOverride(overridesForResolve, patch);
      }
    }
    const profession = resolveProfession(
      profile.professionId,
      overridesForResolve,
      customProfessions,
    );
    if (profession) {
      bags.push(profession.passives);
    }
    const effective = resolveEffectiveStats(profile.base, bags, profile.damageType);
    const applied = applyProfessionCycle(effective, profession);
    return calculateDamage(applied.stats);
  }

  const activeResult = activeProfile ? profileResult(activeProfile) : null;
  const statsWithoutSchemes = activeProfile
    ? profileResult(activeProfile, null, null).effectiveStats
    : null;
  const activeCircuitScheme = activeProfile?.circuitSchemeId
    ? schemesById.get(activeProfile.circuitSchemeId)
    : undefined;
  const activeCircuitContrib = activeCircuitScheme
    ? schemeContribution(
        activeCircuitScheme,
        circuitsById,
        activeProfile?.element ?? "all",
        activeProfile?.damageType ?? "magic",
      )
    : null;
  const activeCircuitLines = activeCircuitContrib
    ? contributionLines(activeCircuitContrib)
    : null;
  const activeInsigniaScheme = activeProfile?.insigniaSchemeId
    ? insigniaSchemesById.get(activeProfile.insigniaSchemeId)
    : undefined;
  const activeInsigniaContrib = activeInsigniaScheme
    ? insigniaSchemeContribution(
        activeInsigniaScheme,
        insigniasById,
        activeProfile?.element ?? "all",
      )
    : null;
  const activeInsigniaLines = activeInsigniaContrib
    ? insigniaContributionLines(activeInsigniaContrib)
    : null;
  const activeSchemeBonuses = bagToStatBonuses(
    mergeStatBags([
      ...(activeCircuitContrib ? [activeCircuitContrib.bag] : []),
      ...(activeInsigniaContrib ? [activeInsigniaContrib.bag] : []),
    ]),
    activeProfile?.damageType ?? "magic",
  );
  const activeInsigniaComparison = useMemo(() => {
    if (!activeProfile || !activeInsigniaScheme) return null;
    return compareSchemeInsignias(
      activeInsigniaScheme,
      insignias,
      insigniasById,
      (scheme) => profileResult(activeProfile, undefined, scheme).finalDamage,
    );
    // profileResult is recreated each render; depend on its inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeProfile,
    activeInsigniaScheme,
    insignias,
    insigniasById,
    circuits,
    circuitSchemes,
    allEquipment,
    allItems,
    professionOverrides,
    customProfessions,
  ]);

  // Preserve compareIds order (first entry is the baseline).
  const compareProfiles = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return compareIds
      .map((id) => byId.get(id))
      .filter((p): p is Profile => p !== undefined);
  }, [profiles, compareIds]);

  const compareResults = useMemo(
    () =>
      compareProfiles.map((p) => ({
        profile: p,
        result: profileResult(p),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compareProfiles, allEquipment, allItems, circuits, circuitSchemes, insignias, insigniaSchemes, professionOverrides, customProfessions, monsterDef],
  );

  const baselineDamage = compareResults[0]?.result.finalDamage ?? activeResult?.finalDamage ?? 1;
  const compareRanked = useMemo(() => {
    const rows = compareResults.map(({ profile, result }) => {
      const bound = configCompareDamage(
        profile.observedTrainingDamage,
        result.trainingDamage,
      );
      return {
        profile,
        formulaTraining: result.trainingDamage,
        damage: bound.value,
        source: bound.source,
      };
    });
    const baselineId = compareResults[0]?.profile.id;
    const baseline =
      rows.find((row) => row.profile.id === baselineId)?.damage ??
      rows[0]?.damage ??
      0;
    return rankConfigDamage(rows, baseline);
  }, [compareResults]);
  const baselineTraining =
    compareRanked.find((row) => row.profile.id === compareResults[0]?.profile.id)
      ?.damage ??
    compareResults[0]?.result.trainingDamage ??
    activeResult?.trainingDamage ??
    1;
  const activeProfession = activeProfile
    ? resolveProfession(
        activeProfile.professionId,
        professionOverrides,
        customProfessions,
      )
    : null;
  const activeCycle = activeProfession
    ? resolvedCycleMultiplier(
        activeProfession.cycleMultiplier,
        activeProfession.skills,
      )
    : 1;

  function applyProfessionToActive(profession: ProfessionDef): void {
    if (!activeProfile) {
      setStatus(m.pickProfileFirst);
      return;
    }
    updateProfile(activeProfile.id, {
      professionId: profession.id,
      damageType: profession.damageType,
      element: profession.defaultElement,
    });
    setStatus(
      m.appliedProfession(
        professionNameLabel(profession.id, locale, profession.name),
        activeProfile.name,
      ),
    );
  }

  function chooseProfileProfession(raw: string): void {
    if (!activeProfile) return;
    if (!raw) {
      updateProfile(activeProfile.id, { professionId: null });
      return;
    }
    const profession = resolveProfession(
      raw as ProfessionDef["id"],
      professionOverrides,
      customProfessions,
    );
    if (!profession) return;
    applyProfessionToActive(profession);
  }

  function scrollEditorIntoViewIfNarrow(): void {
    requestAnimationFrame(() => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 960px)").matches
      ) {
        editorPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  function addProfile(): void {
    const p = blankProfile(m.defaultProfileName(profiles.length + 1));
    setProfiles((list) => [p, ...list]);
    setActiveProfileId(p.id);
    setTab("profiles");
    setStatus(m.addedProfile);
    scrollEditorIntoViewIfNarrow();
  }

  function duplicateProfile(profile: Profile): void {
    const copy: Profile = {
      ...structuredClone(profile),
      id: makeId("profile"),
      name: `${profile.name}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProfiles((list) => [copy, ...list]);
    setActiveProfileId(copy.id);
    setStatus(m.copiedProfile);
    scrollEditorIntoViewIfNarrow();
  }

  async function copyShareUrl(
    url: string,
    label: string,
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(m.promptCopyLink, url);
    }
    const warn =
      url.length > SHARE_URL_WARN_LENGTH
        ? m.urlLongWarn(url.length)
        : "";
    setStatus(`${label}${warn}`);
  }

  /** Profiles currently ticked for 比較 — used as multi-share selection. */
  function getSelectedProfiles(): Profile[] {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return compareIds
      .map((id) => byId.get(id))
      .filter((p): p is Profile => p !== undefined);
  }

  function effectiveStatsFor(profile: Profile): CombatStats {
    const bags: StatBag[] = [];
    for (const eqId of Object.values(profile.equipped)) {
      if (!eqId) continue;
      const eq = equipmentById.get(eqId);
      if (eq) bags.push(eq.stats);
    }
    for (const itemId of profile.itemIds) {
      const item = itemsById.get(itemId);
      if (item) bags.push(item.stats);
    }
    if (profile.circuitSchemeId) {
      const scheme = schemesById.get(profile.circuitSchemeId);
      if (scheme) {
        bags.push(
          schemeContribution(
            scheme,
            circuitsById,
            profile.element ?? "all",
            profile.damageType,
          ).bag,
        );
      }
    }
    if (profile.insigniaSchemeId) {
      const scheme = insigniaSchemesById.get(profile.insigniaSchemeId);
      if (scheme) {
        bags.push(
          insigniaSchemeContribution(
            scheme,
            insigniasById,
            profile.element ?? "all",
          ).bag,
        );
      }
    }
    return resolveEffectiveStats(profile.base, bags, profile.damageType);
  }

  /**
   * Share full profile(s): selected (比較) if any, else the active editing one.
   */
  async function shareProfilesFull(list: Profile[]): Promise<void> {
    if (list.length === 0) {
      setStatus(m.shareNeedSelect);
      return;
    }
    try {
      const payload = buildSharePayload(
        list,
        equipmentById,
        itemsById,
        circuitsById,
        schemesById,
        insigniasById,
        insigniaSchemesById,
      );
      const fragment = await encodeShareFragment(payload);
      const url = buildShareUrl(fragment);
      const label =
        list.length === 1
          ? m.copiedFullOne(list[0]!.name)
          : m.copiedFullMany(list.length);
      await copyShareUrl(url, label);
    } catch {
      setStatus(m.shareFullFail);
    }
  }

  /**
   * Share numeric stats only: selected (比較) if any, else the active editing one.
   */
  async function shareProfilesStats(list: Profile[]): Promise<void> {
    if (list.length === 0) {
      setStatus(m.shareNeedSelect);
      return;
    }
    try {
      const entries = list.map((profile) => ({
        profile,
        stats: effectiveStatsFor(profile),
      }));
      const payload = buildNumericSharePayload(entries);
      const fragment = await encodeShareFragment(payload);
      const url = buildShareUrl(fragment);
      const label =
        list.length === 1
          ? m.copiedStatsOne(list[0]!.name)
          : m.copiedStatsMany(list.length);
      await copyShareUrl(url, label);
    } catch {
      setStatus(m.shareStatsFail);
    }
  }

  async function shareActiveProfile(): Promise<void> {
    if (!activeProfile) {
      setStatus(m.shareNeedProfile);
      return;
    }
    await shareProfilesFull([activeProfile]);
  }

  async function shareActiveProfileStats(): Promise<void> {
    if (!activeProfile) {
      setStatus(m.shareNeedProfile);
      return;
    }
    await shareProfilesStats([activeProfile]);
  }

  async function shareSelectedProfiles(): Promise<void> {
    await shareProfilesFull(getSelectedProfiles());
  }

  async function shareSelectedProfilesStats(): Promise<void> {
    await shareProfilesStats(getSelectedProfiles());
  }

  function applyImportedCircuitScheme(bundle: CircuitSchemeBundle): Profile {
    const now = new Date().toISOString();
    setCircuits((list) => [...bundle.pieces, ...list]);
    setCircuitSchemes((list) => [bundle.scheme, ...list]);
    if (activeProfile) {
      const next: Profile = {
        ...activeProfile,
        circuitSchemeId: bundle.scheme.id,
        updatedAt: now,
      };
      setProfiles((list) =>
        list.map((p) => (p.id === activeProfile.id ? next : p)),
      );
      return next;
    }
    const created: Profile = {
      ...blankProfile(m.defaultProfileName(profiles.length + 1)),
      circuitSchemeId: bundle.scheme.id,
    };
    setProfiles((list) => [created, ...list]);
    setActiveProfileId(created.id);
    return created;
  }

  function applyImportedInsigniaScheme(bundle: InsigniaSchemeBundle): Profile {
    const now = new Date().toISOString();
    setInsignias((list) => [...bundle.pieces, ...list]);
    setInsigniaSchemes((list) => [bundle.scheme, ...list]);
    if (activeProfile) {
      const next: Profile = {
        ...activeProfile,
        insigniaSchemeId: bundle.scheme.id,
        updatedAt: now,
      };
      setProfiles((list) =>
        list.map((p) => (p.id === activeProfile.id ? next : p)),
      );
      return next;
    }
    const created: Profile = {
      ...blankProfile(m.defaultProfileName(profiles.length + 1)),
      insigniaSchemeId: bundle.scheme.id,
    };
    setProfiles((list) => [created, ...list]);
    setActiveProfileId(created.id);
    return created;
  }

  function openProfileWithAppliedScheme(profile: Profile, message: string): void {
    setActiveProfileId(profile.id);
    setTab("profiles");
    setStatus(message);
    scrollEditorIntoViewIfNarrow();
  }

  async function importCircuitSchemeFromCode(code: string): Promise<void> {
    const decoded = await decodeCircuitSchemeCode(code);
    if (!decoded) {
      throw new Error(m.badCircuitCode);
    }
    const bundle = finalizeCircuitSchemeImport(
      decoded,
      circuitSchemes.map((s) => s.name),
    );
    const profile = applyImportedCircuitScheme(bundle);
    openProfileWithAppliedScheme(
      profile,
      m.importedCircuit(bundle.scheme.name, profile.name),
    );
  }

  async function importInsigniaSchemeFromCode(code: string): Promise<void> {
    const decoded = await decodeInsigniaSchemeCode(code);
    if (!decoded) {
      throw new Error(m.badInsigniaCode);
    }
    const bundle = finalizeInsigniaSchemeImport(
      decoded,
      insigniaSchemes.map((s) => s.name),
    );
    const profile = applyImportedInsigniaScheme(bundle);
    openProfileWithAppliedScheme(
      profile,
      m.importedInsignia(bundle.scheme.name, profile.name),
    );
  }

  async function importSchemeOntoActiveProfile(code: string): Promise<void> {
    const kind = peekSchemeShareKind(code);
    if (kind === "circuit") {
      await importCircuitSchemeFromCode(code);
      return;
    }
    if (kind === "insignia") {
      await importInsigniaSchemeFromCode(code);
      return;
    }
    throw new Error(m.badSchemeCode);
  }

  async function exportActiveProfileCircuitScheme(): Promise<string> {
    if (!activeCircuitScheme) {
      throw new Error(m.noCircuitOnProfile);
    }
    return encodeCircuitSchemeCode(activeCircuitScheme, circuitsById);
  }

  async function exportActiveProfileInsigniaScheme(): Promise<string> {
    if (!activeInsigniaScheme) {
      throw new Error(m.noInsigniaOnProfile);
    }
    return encodeInsigniaSchemeCode(activeInsigniaScheme, insigniasById);
  }

  function deleteProfile(id: string): void {
    setProfiles((list) => list.filter((p) => p.id !== id));
    setCompareIds((ids) => ids.filter((x) => x !== id));
    if (activeProfileId === id) {
      setActiveProfileId(profiles.find((p) => p.id !== id)?.id ?? null);
    }
    setStatus(m.deletedProfile);
  }

  function toggleCompare(id: string): void {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return [...ids, id].slice(0, 5);
    });
  }

  /** Select a profile; on narrow layouts scroll the editor into view. */
  function selectProfile(id: string): void {
    setActiveProfileId(id);
    scrollEditorIntoViewIfNarrow();
  }

  function moveCompare(id: string, delta: -1 | 1): void {
    setCompareIds((ids) => {
      const index = ids.indexOf(id);
      if (index < 0) return ids;
      const next = index + delta;
      if (next < 0 || next >= ids.length) return ids;
      const copy = [...ids];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item!);
      return copy;
    });
  }

  function setCompareBaseline(id: string): void {
    setCompareIds((ids) => {
      if (!ids.includes(id) || ids[0] === id) return ids;
      return [id, ...ids.filter((x) => x !== id)];
    });
  }

  function resetGearForm(): void {
    setEditingGearId(null);
    setGearName("");
    setGearSlot("項鍊");
    setGearSet(m.customDefault);
    setGearStats("");
    setGearEffects("");
  }

  function resetItemForm(): void {
    setEditingItemId(null);
    setItemName("");
    setItemStats("");
  }

  function startEditGear(eq: Equipment): void {
    setEditingGearId(eq.id);
    setGearName(eq.name);
    setGearSlot(eq.slot);
    setGearSet(eq.set ?? m.customDefault);
    setGearStats(statsToText(eq.stats, eq.statLines));
    setGearEffects((eq.effects ?? []).join("\n"));
    setTab("gear");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditItem(item: CatalogItem): void {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemStats(statsToText(item.stats, item.statLines));
    setTab("items");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveGearForm(): void {
    if (!gearName.trim()) {
      setStatus(m.needGearName);
      return;
    }
    const { stats, lines } = parseStatLines(gearStats);
    const effects = gearEffects
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const base: Equipment = {
      id: editingGearId ?? makeId("gear"),
      name: gearName.trim(),
      slot: gearSlot,
      set: gearSet.trim() || m.customDefault,
      stats,
      statLines: lines.length ? lines : [m.noParsedStats],
      effects,
      source: "custom",
      demo: false,
    };

    setCustomEquipment((list) => {
      const idx = list.findIndex((e) => e.id === base.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...list[idx], ...base, demo: false };
        return next;
      }
      // editing a demo (not yet in custom) or brand new
      return [base, ...list];
    });
    // if it was hidden, unhide on save
    setHiddenEquipmentIds((ids) => ids.filter((id) => id !== base.id));
    setStatus(editingGearId ? m.updatedGear(base.name) : m.addedGear(base.name));
    resetGearForm();
  }

  function saveItemForm(): void {
    if (!itemName.trim()) {
      setStatus(m.needItemName);
      return;
    }
    const { stats, lines } = parseStatLines(itemStats);
    const base: CatalogItem = {
      id: editingItemId ?? makeId("item"),
      name: itemName.trim(),
      kind: "item",
      stats,
      statLines: lines.length ? lines : [m.noParsedStats],
      demo: false,
    };

    setCustomItems((list) => {
      const idx = list.findIndex((e) => e.id === base.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...list[idx], ...base, demo: false };
        return next;
      }
      return [base, ...list];
    });
    setHiddenItemIds((ids) => ids.filter((id) => id !== base.id));
    setStatus(editingItemId ? m.updatedItem(base.name) : m.addedItem(base.name));
    resetItemForm();
  }

  function detachGearFromProfiles(ids: string[]): void {
    const idSet = new Set(ids);
    setProfiles((list) =>
      list.map((p) => {
        const equipped = { ...p.equipped };
        for (const [slot, eqId] of Object.entries(equipped)) {
          if (eqId && idSet.has(eqId)) equipped[slot] = null;
        }
        return { ...p, equipped };
      }),
    );
  }

  function detachItemsFromProfiles(ids: string[]): void {
    const idSet = new Set(ids);
    setProfiles((list) =>
      list.map((p) => ({
        ...p,
        itemIds: p.itemIds.filter((x) => !idSet.has(x)),
      })),
    );
  }

  function deleteEquipmentIds(ids: string[]): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const demoIdSet = new Set(demoEquipment.map((e) => e.id));

    setCustomEquipment((list) => list.filter((e) => !idSet.has(e.id)));
    setHiddenEquipmentIds((hidden) => {
      const next = new Set(hidden);
      for (const id of ids) {
        if (demoIdSet.has(id)) next.add(id);
      }
      return [...next];
    });
    detachGearFromProfiles(ids);
    setSelectedGearIds((sel) => sel.filter((id) => !idSet.has(id)));
    if (editingGearId && idSet.has(editingGearId)) resetGearForm();
    setStatus(m.deletedGearN(ids.length));
  }

  function deleteItemIds(ids: string[]): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const demoIdSet = new Set(demoItems.map((e) => e.id));

    setCustomItems((list) => list.filter((e) => !idSet.has(e.id)));
    setHiddenItemIds((hidden) => {
      const next = new Set(hidden);
      for (const id of ids) {
        if (demoIdSet.has(id)) next.add(id);
      }
      return [...next];
    });
    detachItemsFromProfiles(ids);
    setSelectedItemIds((sel) => sel.filter((id) => !idSet.has(id)));
    if (editingItemId && idSet.has(editingItemId)) resetItemForm();
    setStatus(m.deletedItemN(ids.length));
  }

  function toggleGearSelect(id: string): void {
    setSelectedGearIds((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id],
    );
  }

  function toggleItemSelect(id: string): void {
    setSelectedItemIds((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id],
    );
  }

  async function handleGearCsvImport(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = importEquipmentCsv(text, allEquipment);
      if (result.created.length === 0 && result.updated.length === 0) {
        setStatus(
          result.errors.length
            ? m.importFailErrors(result.errors.slice(0, 3).join("; "))
            : m.importFailEmpty,
        );
        return;
      }
      setCustomEquipment((list) => applyEquipmentImport(list, result));
      // unhide any updated demos
      const touchIds = [
        ...result.created.map((e) => e.id),
        ...result.updated.map((e) => e.id),
      ];
      setHiddenEquipmentIds((ids) => ids.filter((id) => !touchIds.includes(id)));
      const errNote = result.errors.length
        ? m.skippedRows(result.errors.length)
        : "";
      setStatus(
        m.gearImportDone(result.created.length, result.updated.length, errNote),
      );
    } catch {
      setStatus(m.gearCsvFail);
    }
  }

  async function handleItemCsvImport(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = importItemsCsv(text, allItems);
      if (result.created.length === 0 && result.updated.length === 0) {
        setStatus(
          result.errors.length
            ? m.importFailErrors(result.errors.slice(0, 3).join("; "))
            : m.importFailEmpty,
        );
        return;
      }
      setCustomItems((list) => applyItemImport(list, result));
      const touchIds = [
        ...result.created.map((e) => e.id),
        ...result.updated.map((e) => e.id),
      ];
      setHiddenItemIds((ids) => ids.filter((id) => !touchIds.includes(id)));
      const errNote = result.errors.length
        ? m.skippedRows(result.errors.length)
        : "";
      setStatus(
        m.itemImportDone(result.created.length, result.updated.length, errNote),
      );
    } catch {
      setStatus(m.itemCsvFail);
    }
  }

  function exportAll(): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            profiles,
            customEquipment,
            customItems,
            hiddenEquipmentIds,
            hiddenItemIds,
            circuits,
            circuitSchemes,
            insignias,
            insigniaSchemes,
            professionOverrides,
            customProfessions,
            compareIds,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coa-dmg-calc-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus(m.exportedJson);
  }

  async function importAll(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        profiles?: Profile[];
        customEquipment?: Equipment[];
        customItems?: CatalogItem[];
        circuits?: CircuitPiece[];
        circuitSchemes?: CircuitScheme[];
        insignias?: InsigniaPiece[];
        insigniaSchemes?: InsigniaScheme[];
        professionOverrides?: ProfessionOverride[];
        customProfessions?: ProfessionDef[];
        hiddenEquipmentIds?: string[];
        hiddenItemIds?: string[];
        compareIds?: string[];
      };
      if (Array.isArray(data.profiles)) setProfiles(data.profiles);
      if (Array.isArray(data.customEquipment)) setCustomEquipment(data.customEquipment);
      if (Array.isArray(data.customItems)) setCustomItems(data.customItems);
      if (Array.isArray(data.circuits)) setCircuits(data.circuits);
      if (Array.isArray(data.circuitSchemes)) setCircuitSchemes(data.circuitSchemes);
      if (Array.isArray(data.insignias)) setInsignias(data.insignias);
      if (Array.isArray(data.insigniaSchemes)) setInsigniaSchemes(data.insigniaSchemes);
      if (Array.isArray(data.professionOverrides)) {
        setProfessionOverrides(
          data.professionOverrides
            .map(normalizeProfessionOverride)
            .filter((x): x is ProfessionOverride => x !== null),
        );
      }
      if (Array.isArray(data.customProfessions)) {
        setCustomProfessions(
          data.customProfessions
            .map(normalizeCustomProfession)
            .filter((x): x is ProfessionDef => x !== null),
        );
      }
      if (Array.isArray(data.hiddenEquipmentIds)) {
        setHiddenEquipmentIds(data.hiddenEquipmentIds);
      }
      if (Array.isArray(data.hiddenItemIds)) setHiddenItemIds(data.hiddenItemIds);
      if (Array.isArray(data.compareIds)) setCompareIds(data.compareIds);
      setStatus(m.importedJson);
    } catch {
      setStatus(m.jsonBad);
    }
  }

  const filteredGear = allEquipment.filter((e) => {
    if (slotFilter !== "all" && e.slot !== slotFilter) return false;
    if (!gearFilter.trim()) return true;
    const q = gearFilter.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.set ?? "").toLowerCase().includes(q) ||
      e.slot.toLowerCase().includes(q)
    );
  });

  const filteredItems = allItems.filter((item) => {
    if (!itemFilter.trim()) return true;
    const q = itemFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.statLines.some((line) => line.toLowerCase().includes(q))
    );
  });

  const allFilteredGearSelected =
    filteredGear.length > 0 &&
    filteredGear.every((e) => selectedGearIds.includes(e.id));
  const allFilteredItemsSelected =
    filteredItems.length > 0 &&
    filteredItems.every((e) => selectedItemIds.includes(e.id));

  const slotsInUse = useMemo(() => {
    const set = new Set<string>(EQUIPMENT_SLOTS as unknown as string[]);
    for (const e of allEquipment) set.add(e.slot);
    return [...set];
  }, [allEquipment]);

  if (!ready) {
    return (
      <div className="app-shell">
        <p>{m.loading}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <div className="hero-title-row">
            <h1>{m.appTitle}</h1>
            <div className="lang-switch" role="group" aria-label={m.langAria}>
              <button
                type="button"
                className={locale === "zh" ? "active" : ""}
                onClick={() => setLocale("zh")}
              >
                {m.langZh}
              </button>
              <button
                type="button"
                className={locale === "en" ? "active" : ""}
                onClick={() => setLocale("en")}
              >
                {m.langEn}
              </button>
            </div>
          </div>
          <p>{m.appSubtitle}</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={addProfile}>
            {m.addProfile}
          </button>
          <button type="button" className="secondary" onClick={exportAll}>
            {m.exportJson}
          </button>
          <label className="file-button">
            {m.importJson}
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importAll(f);
              }}
            />
          </label>
        </div>
      </header>

      <nav className="tabs" aria-label={m.tabsAria}>
        {(
          [
            ["profiles", m.tabProfiles, m.tabProfilesShort],
            ["gear", m.tabGear, m.tabGearShort],
            ["items", m.tabItems, m.tabItemsShort],
            ["circuits", m.tabCircuits, m.tabCircuitsShort],
            ["insignias", m.tabInsignias, m.tabInsigniasShort],
            ["professions", m.tabProfessions, m.tabProfessionsShort],
            ["compare", m.tabCompare, m.tabCompareShort],
          ] as const
        ).map(([id, label, shortLabel]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <span className="tab-label-full">{label}</span>
            <span className="tab-label-short">{shortLabel}</span>
          </button>
        ))}
      </nav>

      {status ? (
        <p className="status-banner" role="status">
          {status}
        </p>
      ) : null}

      {tab === "profiles" && (
        <div className="layout-2">
          <section className="panel">
            <div className="panel-heading">
              <h2>{m.profileList}</h2>
              {compareIds.length > 0 ? (
                <div className="panel-heading-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void shareSelectedProfiles()}
                    title={m.shareSelectedFullTitle}
                  >
                    {m.shareSelectedFull(compareIds.length)}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void shareSelectedProfilesStats()}
                    title={m.shareSelectedStatsTitle}
                  >
                    {m.shareSelectedStats(compareIds.length)}
                  </button>
                </div>
              ) : null}
            </div>
            <p className="muted small">{m.shareMultiHint}</p>
            <div className="profile-list">
              {profiles.length === 0 ? (
                <p className="muted">{m.noProfiles}</p>
              ) : (
                profiles.map((p) => {
                  const res = profileResult(p);
                  const selected = p.id === activeProfileId;
                  const inCompare = compareIds.includes(p.id);
                  return (
                    <article
                      key={p.id}
                      className={`profile-card ${selected ? "active" : ""}`}
                    >
                      <div className="profile-card-head">
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => selectProfile(p.id)}
                        >
                          <h3>{p.name}</h3>
                        </button>
                        <label className="check-inline profile-compare">
                          <input
                            type="checkbox"
                            checked={inCompare}
                            onChange={() => toggleCompare(p.id)}
                            aria-label={m.compareSelectAria(p.name)}
                          />
                          <span className="check-label-full">{m.compareSelect}</span>
                        </label>
                      </div>
                      <p className="muted small profile-card-note">
                        {p.professionId
                          ? professionNameLabel(
                              p.professionId,
                              locale,
                              findProfession(p.professionId, customProfessions)
                                ?.name,
                            )
                          : m.noProfessionShort}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                      <div className="profile-card-meta">
                        <div className="dmg-chip">
                          <span className="dmg-chip-label">
                            {configCompareDamage(
                              p.observedTrainingDamage,
                              res.trainingDamage,
                            ).source === "observed"
                              ? m.observedTag
                              : m.trainingDummy}{" "}
                          </span>
                          <strong>
                            {formatDamage(
                              configCompareDamage(
                                p.observedTrainingDamage,
                                res.trainingDamage,
                              ).value,
                            )}
                          </strong>
                        </div>
                        <div className="card-actions profile-card-actions">
                          <button
                            type="button"
                            onClick={() => selectProfile(p.id)}
                            aria-label={m.editAria(p.name)}
                            title={m.edit}
                          >
                            <span className="action-text">{m.edit}</span>
                            <span className="action-icon" aria-hidden="true">
                              ✎
                            </span>
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => duplicateProfile(p)}
                            aria-label={m.copyAria(p.name)}
                            title={m.copy}
                          >
                            <span className="action-text">{m.copy}</span>
                            <span className="action-icon" aria-hidden="true">
                              ⧉
                            </span>
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => deleteProfile(p.id)}
                            aria-label={m.deleteAria(p.name)}
                            title={m.delete}
                          >
                            <span className="action-text">{m.delete}</span>
                            <span className="action-icon" aria-hidden="true">
                              ⌫
                            </span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel" ref={editorPanelRef} id="profile-editor">
            {activeProfile && activeResult ? (
              <>
                <div className="panel-heading">
                  <h2>{m.editing(activeProfile.name)}</h2>
                  <div className="panel-heading-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void shareActiveProfile()}
                      title={m.shareFullTitle}
                    >
                      {m.shareFull}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void shareActiveProfileStats()}
                      title={m.shareStatsTitle}
                    >
                      {m.shareStats}
                    </button>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    {m.name}
                    <input
                      value={activeProfile.name}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {m.note}
                    <input
                      value={activeProfile.note}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, { note: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {m.observedTraining}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      placeholder={m.observedTrainingPh}
                      value={
                        activeProfile.observedTrainingDamage != null
                          ? activeProfile.observedTrainingDamage
                          : ""
                      }
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          observedTrainingDamage: parseObservedDamage(
                            e.target.value,
                          ),
                        })
                      }
                    />
                    <span className="stat-scheme-bonus">
                      {activeProfile.observedTrainingDamage
                        ? m.observedTag
                        : m.noObserved}
                    </span>
                  </label>
                  <label>
                    {m.profession}
                    <select
                      value={activeProfile.professionId ?? ""}
                      onChange={(e) => chooseProfileProfession(e.target.value)}
                    >
                      <option value="">{m.noProfessionOption}</option>
                      {listProfessions(customProfessions).map((p) => (
                        <option key={p.id} value={p.id}>
                          {professionNameLabel(p.id, locale, p.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {m.damageType}
                    <select
                      value={activeProfile.damageType}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          damageType: e.target.value as Profile["damageType"],
                        })
                      }
                    >
                      <option value="magic">{m.magic}</option>
                      <option value="physical">{m.physical}</option>
                    </select>
                  </label>
                  <label>
                    {m.skillElement}
                    <select
                      value={activeProfile.element ?? "all"}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          element: e.target.value as CircuitElement | "all",
                        })
                      }
                    >
                      <option value="all">{m.elementAll}</option>
                      <option value="ice">{circuitElementLabel("ice")}</option>
                      <option value="fire">{circuitElementLabel("fire")}</option>
                      <option value="electric">
                        {circuitElementLabel("electric")}
                      </option>
                      <option value="dark">{circuitElementLabel("dark")}</option>
                    </select>
                  </label>
                  <label>
                    {m.circuitScheme}
                    <select
                      value={activeProfile.circuitSchemeId ?? ""}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          circuitSchemeId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">{m.noCircuitScheme}</option>
                      {circuitSchemes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {m.schemeCount(s.name, equippedCount(s))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {m.insigniaScheme}
                    <select
                      value={activeProfile.insigniaSchemeId ?? ""}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          insigniaSchemeId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">{m.noInsigniaScheme}</option>
                      {insigniaSchemes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {m.schemeCount(s.name, insigniaEquippedCount(s))}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <ProfileSchemeShareBox
                  canExportCircuit={!!activeCircuitScheme}
                  canExportInsignia={!!activeInsigniaScheme}
                  onExportCircuit={exportActiveProfileCircuitScheme}
                  onExportInsignia={exportActiveProfileInsigniaScheme}
                  onImport={importSchemeOntoActiveProfile}
                  onStatus={setStatus}
                />

                <h3 className="section-title">{m.baseStats}</h3>
                <p className="muted small">{m.baseStatsHint}</p>
                <div className="stats-grid">
                  {BASE_FIELDS.map(({ key, step }) => {
                    const isPercent = PERCENT_STATS.has(key);
                    const stored = Number(activeProfile.base[key] ?? 0);
                    const bonus = activeSchemeBonuses[key] ?? 0;
                    return (
                      <label key={key}>
                        {statLabel(key)}
                        {isPercent ? " (%)" : ""}
                        <div className={isPercent ? "input-with-suffix" : undefined}>
                          <input
                            type="number"
                            step={step ?? "1"}
                            value={baseStatInputValue(key, stored)}
                            onChange={(e) =>
                              updateBaseStat(key, e.target.value)
                            }
                          />
                          {isPercent ? <span className="input-suffix">%</span> : null}
                        </div>
                        {bonus ? (
                          <span className="stat-scheme-bonus">
                            {m.schemeBonus(formatSignedStatValue(key, bonus))}
                          </span>
                        ) : null}
                        {key === "skillMultiplier" && activeProfession ? (
                          <span className="stat-scheme-bonus">
                            {m.cycleOnMultiplier(
                              professionNameLabel(
                                activeProfession.id,
                                locale,
                                activeProfession.name,
                              ),
                              activeCycle.toFixed(3),
                              (
                                (Number.isFinite(stored) && stored !== 0
                                  ? stored
                                  : 1) * activeCycle
                              ).toFixed(3),
                            )}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                  {SCHEME_EXTRA_FIELDS.map((key) => {
                    const bonus = activeSchemeBonuses[key] ?? 0;
                    if (!bonus) return null;
                    return (
                      <label key={key} className="stat-scheme-extra">
                        {statLabel(key)}
                        <div className="stat-scheme-total">
                          {formatSignedStatValue(key, bonus)}
                        </div>
                        <span className="stat-scheme-bonus">{m.schemeProvided}</span>
                      </label>
                    );
                  })}
                </div>

                <h3 className="section-title">{m.equipSlots}</h3>
                <div className="equip-grid">
                  {slotsInUse.map((slot) => {
                    const options = allEquipment.filter((e) => e.slot === slot);
                    if (options.length === 0) return null;
                    const current = activeProfile.equipped[slot] ?? "";
                    return (
                      <label key={slot}>
                        {slotLabel(slot)}
                        <select
                          value={current}
                          onChange={(e) =>
                            equipSlot(slot, e.target.value || null)
                          }
                        >
                          <option value="">{m.unequipped}</option>
                          {options.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                              {e.demo ? "" : " ★"}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>

                <h3 className="section-title">{m.circuitSocket}</h3>
                {activeCircuitScheme && activeCircuitLines ? (
                  <div className="circuit-profile-summary">
                    <p className="muted small">
                      {m.currentScheme(
                        activeCircuitScheme.name,
                        equippedCount(activeCircuitScheme),
                      )}
                    </p>
                    {activeCircuitLines.damage.length > 0 ? (
                      <ul className="stat-lines">
                        {activeCircuitLines.damage.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">{m.schemeNoDamage}</p>
                    )}
                  </div>
                ) : (
                  <p className="muted small">
                    {m.noCircuitApplied}
                  </p>
                )}

                <h3 className="section-title">{m.insigniaSocket}</h3>
                {activeInsigniaScheme && activeInsigniaLines ? (
                  <div className="circuit-profile-summary">
                    <p className="muted small">
                      {m.currentScheme(
                        activeInsigniaScheme.name,
                        insigniaEquippedCount(activeInsigniaScheme),
                      )}
                    </p>
                    {activeInsigniaLines.damage.length > 0 ? (
                      <ul className="stat-lines">
                        {activeInsigniaLines.damage.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">{m.schemeNoDamage}</p>
                    )}
                    {activeInsigniaComparison &&
                    activeInsigniaComparison.equipped.length > 0 ? (
                      <InsigniaProfileGains
                        comparison={activeInsigniaComparison}
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="muted small">
                    {m.noInsigniaApplied}
                  </p>
                )}

                <h3 className="section-title">{m.itemsBuffs}</h3>
                <div className="item-toggle-grid">
                  {allItems.map((item) => {
                    const on = activeProfile.itemIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`item-toggle ${on ? "on" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleItem(item.id)}
                        />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.statLines.join(" · ")}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <h3 className="section-title">{m.calcResult}</h3>
                <div className="result-panel">
                  <div className="result-main">
                    <div>
                      <span className="muted">{m.trainingDamage}</span>
                      <div className="result-dmg">
                        {formatDamage(
                          configCompareDamage(
                            activeProfile.observedTrainingDamage,
                            activeResult.trainingDamage,
                          ).value,
                        )}
                      </div>
                      <span className="muted small">
                        {configCompareDamage(
                          activeProfile.observedTrainingDamage,
                          activeResult.trainingDamage,
                        ).source === "observed"
                          ? `${m.observedTag} · ${m.formulaTag} ${formatDamage(activeResult.trainingDamage)}`
                          : m.trainingNoBoss(TRAINING_DUMMY_DEF)}
                        {activeProfession
                          ? ` · ${m.cycleOn(professionNameLabel(activeProfession.id, locale, activeProfession.name), activeCycle.toFixed(3))}`
                          : ""}
                      </span>
                    </div>
                    <div>
                      <span className="muted">{m.finalDamageBoss}</span>
                      <div className="result-sub">
                        {formatDamage(activeResult.finalDamage)}
                      </div>
                    </div>
                    <label>
                      {m.monsterDef}
                      <select
                        value={monsterDef}
                        onChange={(e) => setMonsterDef(Number(e.target.value))}
                      >
                        {monsterDefs().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="muted">{m.vsMonster}</span>
                      <div className="result-sub">
                        {formatDamage(activeResult.vsMonster(monsterDef))}
                      </div>
                    </div>
                  </div>

                  <h4>{m.effectiveStats}</h4>
                  <dl className="stat-list">
                    {(Object.keys(STAT_LABELS) as Array<keyof CombatStats>).map(
                      (key) => {
                        const value = Number(activeResult.effectiveStats[key] ?? 0);
                        const without = Number(statsWithoutSchemes?.[key] ?? 0);
                        const delta = value - without;
                        if (key === "attackPercent" || key === "normalAttackDamage") {
                          if (!value && !delta) return null;
                        }
                        return (
                          <div key={key}>
                            <dt>{statLabel(key)}</dt>
                            <dd>
                              {formatStatValue(key, value)}
                              {delta ? (
                                <small className="stat-scheme-bonus">
                                  {m.schemeBonus(formatSignedStatValue(key, delta))}
                                </small>
                              ) : null}
                            </dd>
                          </div>
                        );
                      },
                    )}
                  </dl>

                  <h4>{m.formulaZones}</h4>
                  <dl className="stat-list compact">
                    {Object.entries(activeResult.factors).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{Number(v).toFixed(4)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="formula-note">{m.formulaNote}</p>
                </div>
              </>
            ) : (
              <p className="muted">{m.pickProfile}</p>
            )}
          </section>
        </div>
      )}

      {tab === "gear" && (
        <div className="layout-2">
          <section className="panel">
            <h2>{editingGearId ? m.editGear : m.addGear}</h2>
            <p className="muted small">
              {m.gearStatHint} <code>Skill DMG +12%</code>, <code>技能傷害 +12%</code>
            </p>
            <div className="form-grid">
              <label>
                {m.name}
                <input
                  value={gearName}
                  onChange={(e) => setGearName(e.target.value)}
                  placeholder={m.gearNamePh}
                />
              </label>
              <label>
                {m.slot}
                <select
                  value={gearSlot}
                  onChange={(e) => setGearSlot(e.target.value)}
                >
                  {slotsInUse.map((s) => (
                    <option key={s} value={s}>
                      {slotLabel(s)}
                    </option>
                  ))}
                  <option value="其他">{m.otherSlot}</option>
                </select>
              </label>
              <label>
                {m.setName}
                <input
                  value={gearSet}
                  onChange={(e) => setGearSet(e.target.value)}
                  placeholder={m.setPh}
                />
              </label>
              <label>
                {m.statsMultiline}
                <textarea
                  rows={6}
                  value={gearStats}
                  onChange={(e) => setGearStats(e.target.value)}
                  placeholder={m.gearStatsPh}
                />
              </label>
              <label>
                {m.effectsOptional}
                <textarea
                  rows={3}
                  value={gearEffects}
                  onChange={(e) => setGearEffects(e.target.value)}
                  placeholder={m.effectsPh}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={saveGearForm}>
                  {editingGearId ? m.saveChanges : m.addGear}
                </button>
                {editingGearId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetGearForm}
                  >
                    {m.cancelEdit}
                  </button>
                ) : null}
              </div>
            </div>

            <h3 className="section-title">{m.batchImport}</h3>
            <p className="muted small">{m.gearCsvHint}</p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("equipment-template.csv", GEAR_CSV_TEMPLATE)
                }
              >
                {m.downloadCsvTemplate}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("equipment-export.csv", equipmentToCsv(allEquipment))
                }
              >
                {m.exportGearCsv}
              </button>
              <label className="file-button">
                {m.importCsv}
                <input
                  ref={gearImportRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleGearCsvImport(e)}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>
              {m.tabGear}{" "}
              <span className="muted small">
                ({filteredGear.length} / {allEquipment.length})
              </span>
            </h2>
            <p className="muted small">
              {m.gearLibHint}
            </p>
            <div className="filter-row">
              <input
                placeholder={m.searchGear}
                value={gearFilter}
                onChange={(e) => setGearFilter(e.target.value)}
              />
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
              >
                <option value="all">{m.allSlots}</option>
                {slotsInUse.map((s) => (
                  <option key={s} value={s}>
                    {slotLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="batch-bar">
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={allFilteredGearSelected}
                  onChange={() => {
                    if (allFilteredGearSelected) {
                      const visible = new Set(filteredGear.map((e) => e.id));
                      setSelectedGearIds((sel) =>
                        sel.filter((id) => !visible.has(id)),
                      );
                    } else {
                      setSelectedGearIds((sel) => [
                        ...new Set([...sel, ...filteredGear.map((e) => e.id)]),
                      ]);
                    }
                  }}
                />
                {m.selectAllVisible}
              </label>
              <span className="muted small">
                {m.selectedCount(selectedGearIds.length)}
              </span>
              <button
                type="button"
                className="danger"
                disabled={selectedGearIds.length === 0}
                onClick={() => {
                  if (
                    window.confirm(m.confirmDeleteGearN(selectedGearIds.length))
                  ) {
                    deleteEquipmentIds(selectedGearIds);
                  }
                }}
              >
                {m.deleteSelected}
              </button>
            </div>
            <div className="gear-list">
              {filteredGear.map((e) => {
                const selected = selectedGearIds.includes(e.id);
                const isUserOwned = customEquipment.some((c) => c.id === e.id);
                return (
                  <article
                    key={e.id}
                    className={`gear-card ${selected ? "selected" : ""} ${
                      editingGearId === e.id ? "editing" : ""
                    }`}
                  >
                    <div className="gear-card-head">
                      <label className="check-inline card-select">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGearSelect(e.id)}
                        />
                      </label>
                      <div className="gear-card-body">
                        <h3>
                          {e.name}
                          {isUserOwned ? " ★" : ""}
                        </h3>
                        <p className="muted small">
                          {e.slot}
                          {e.set ? ` · ${e.set}` : ""}
                          {e.source ? ` · ${e.source}` : ""}
                        </p>
                      </div>
                      <div className="card-actions tight">
                        <button type="button" onClick={() => startEditGear(e)}>
                          {m.edit}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            if (window.confirm(m.confirmDeleteNamed(e.name))) {
                              deleteEquipmentIds([e.id]);
                            }
                          }}
                        >
                          {m.delete}
                        </button>
                      </div>
                    </div>
                    <ul className="stat-lines">
                      {e.statLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    {e.effects.length > 0 ? (
                      <details>
                        <summary>{m.effectsSummary}</summary>
                        <ul className="effect-lines">
                          {e.effects.map((fx) => (
                            <li key={fx}>{fx}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "items" && (
        <div className="layout-2">
          <section className="panel">
            <h2>{editingItemId ? m.editItem : m.addItem}</h2>
            <div className="form-grid">
              <label>
                {m.name}
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={m.itemNamePh}
                />
              </label>
              <label>
                {m.statsMultiline}
                <textarea
                  rows={5}
                  value={itemStats}
                  onChange={(e) => setItemStats(e.target.value)}
                  placeholder={m.itemStatsPh}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={saveItemForm}>
                  {editingItemId ? m.saveChanges : m.addItemBtn}
                </button>
                {editingItemId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetItemForm}
                  >
                    {m.cancelEdit}
                  </button>
                ) : null}
              </div>
            </div>

            <h3 className="section-title">{m.batchImport}</h3>
            <p className="muted small">{m.itemCsvHint}</p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("items-template.csv", ITEM_CSV_TEMPLATE)
                }
              >
                {m.downloadCsvTemplate}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("items-export.csv", itemsToCsv(allItems))
                }
              >
                {m.exportItemCsv}
              </button>
              <label className="file-button">
                {m.importCsv}
                <input
                  ref={itemImportRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleItemCsvImport(e)}
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>
              {m.tabItems}{" "}
              <span className="muted small">
                ({filteredItems.length} / {allItems.length})
              </span>
            </h2>
            <p className="muted small">
              {m.itemLibHint}
            </p>
            <div className="filter-row">
              <input
                placeholder={m.searchItems}
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
              />
            </div>
            <div className="batch-bar">
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={allFilteredItemsSelected}
                  onChange={() => {
                    if (allFilteredItemsSelected) {
                      const visible = new Set(filteredItems.map((e) => e.id));
                      setSelectedItemIds((sel) =>
                        sel.filter((id) => !visible.has(id)),
                      );
                    } else {
                      setSelectedItemIds((sel) => [
                        ...new Set([...sel, ...filteredItems.map((e) => e.id)]),
                      ]);
                    }
                  }}
                />
                {m.selectAllVisible}
              </label>
              <span className="muted small">
                {m.selectedCount(selectedItemIds.length)}
              </span>
              <button
                type="button"
                className="danger"
                disabled={selectedItemIds.length === 0}
                onClick={() => {
                  if (
                    window.confirm(m.confirmDeleteItemN(selectedItemIds.length))
                  ) {
                    deleteItemIds(selectedItemIds);
                  }
                }}
              >
                {m.deleteSelected}
              </button>
            </div>
            <div className="gear-list">
              {filteredItems.map((item) => {
                const selected = selectedItemIds.includes(item.id);
                const isCustom = customItems.some((c) => c.id === item.id);
                return (
                  <article
                    key={item.id}
                    className={`gear-card ${selected ? "selected" : ""} ${
                      editingItemId === item.id ? "editing" : ""
                    }`}
                  >
                    <div className="gear-card-head">
                      <label className="check-inline card-select">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleItemSelect(item.id)}
                        />
                      </label>
                      <div className="gear-card-body">
                        <h3>
                          {item.name}
                          {isCustom || !item.demo ? " ★" : ""}
                        </h3>
                      </div>
                      <div className="card-actions tight">
                        <button
                          type="button"
                          onClick={() => startEditItem(item)}
                        >
                          {m.edit}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            if (window.confirm(m.confirmDeleteNamed(item.name))) {
                              deleteItemIds([item.id]);
                            }
                          }}
                        >
                          {m.delete}
                        </button>
                      </div>
                    </div>
                    <ul className="stat-lines">
                      {item.statLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "circuits" && (
        <CircuitTab
          circuits={circuits}
          schemes={circuitSchemes}
          setCircuits={setCircuits}
          setSchemes={setCircuitSchemes}
          activeProfile={activeProfile}
          onApplyScheme={(schemeId) => {
            if (!activeProfile) {
              setStatus(m.pickProfileFirst);
              return;
            }
            updateProfile(activeProfile.id, { circuitSchemeId: schemeId });
          }}
          onStatus={setStatus}
          onImportShareCode={importCircuitSchemeFromCode}
          profileResult={profileResult}
        />
      )}

      {tab === "insignias" && (
        <InsigniaTab
          insignias={insignias}
          schemes={insigniaSchemes}
          setInsignias={setInsignias}
          setSchemes={setInsigniaSchemes}
          activeProfile={activeProfile}
          onApplyScheme={(schemeId) => {
            if (!activeProfile) {
              setStatus(m.pickProfileFirst);
              return;
            }
            updateProfile(activeProfile.id, { insigniaSchemeId: schemeId });
          }}
          onStatus={setStatus}
          onImportShareCode={importInsigniaSchemeFromCode}
          profileResult={profileResult}
        />
      )}

      {tab === "professions" && (
        <ProfessionTab
          activeProfile={activeProfile}
          overrides={professionOverrides}
          setOverrides={setProfessionOverrides}
          customProfessions={customProfessions}
          setCustomProfessions={setCustomProfessions}
          profileResult={profileResult}
          onApplyProfession={applyProfessionToActive}
          onDeleteCustomProfession={(id) => {
            setProfiles((list) =>
              list.map((p) =>
                p.professionId === id ? { ...p, professionId: null } : p,
              ),
            );
          }}
          onStatus={setStatus}
        />
      )}

      {tab === "compare" && (
        <section className="panel wide">
          <h2>{m.compareTitle}</h2>
          <p className="muted">{m.compareHint}</p>
          <div className="filter-row">
            <label className="inline-label">
              {m.monsterDef}
              <select
                value={monsterDef}
                onChange={(e) => setMonsterDef(Number(e.target.value))}
              >
                {monsterDefs().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {compareProfiles.length > 0 ? (
            <div className="compare-order">
              <h3 className="section-title" style={{ marginTop: 0 }}>
                {m.compareOrder}
              </h3>
              <ol className="compare-order-list">
                {compareProfiles.map((p, index) => (
                  <li key={p.id} className="compare-order-item">
                    <span className="compare-order-rank">
                      {index === 0 ? m.baseline : index + 1}
                    </span>
                    <span className="compare-order-name">{p.name}</span>
                    <span className="muted small">
                      {formatDamage(
                        configCompareDamage(
                          p.observedTrainingDamage,
                          profileResult(p).trainingDamage,
                        ).value,
                      )}{" "}
                      {configCompareDamage(
                        p.observedTrainingDamage,
                        profileResult(p).trainingDamage,
                      ).source === "observed"
                        ? m.observedTag
                        : m.trainingChip}
                    </span>
                    <div className="compare-order-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === 0}
                        onClick={() => moveCompare(p.id, -1)}
                        title={m.moveUp}
                        aria-label={m.moveUpAria(p.name)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === compareProfiles.length - 1}
                        onClick={() => moveCompare(p.id, 1)}
                        title={m.moveDown}
                        aria-label={m.moveDownAria(p.name)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === 0}
                        onClick={() => setCompareBaseline(p.id)}
                        title={m.setBaselineTitle}
                      >
                        {m.setBaseline}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {compareRanked.length < 2 ? (
            <p className="muted">{m.needTwoProfiles}</p>
          ) : (
            <div className="compare-ratio">
              <h3 className="section-title">{m.damageRatioTitle}</h3>
              <p className="muted small">{m.boundDamageHint}</p>
              <div className="compare-table-wrap">
                <table className="compare-table profession-rank-table">
                  <thead>
                    <tr>
                      <th>{m.colRank}</th>
                      <th>{m.name}</th>
                      <th>{m.colBoundDmg}</th>
                      <th>{m.ratioOfBaseline}</th>
                      <th>{m.ratioOfBest}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRanked.map((row) => (
                      <tr
                        key={row.profile.id}
                        className={
                          row.profile.id === compareResults[0]?.profile.id
                            ? "profession-row-active"
                            : ""
                        }
                      >
                        <td className="num">{row.rank}</td>
                        <td>
                          <strong>{row.profile.name}</strong>
                          <div className="muted small">
                            {row.profile.professionId
                              ? professionNameLabel(
                                  row.profile.professionId,
                                  locale,
                                  findProfession(
                                    row.profile.professionId,
                                    customProfessions,
                                  )?.name,
                                )
                              : m.noProfessionShort}
                            {" · "}
                            {row.source === "observed"
                              ? m.observedTag
                              : m.formulaTag}
                          </div>
                        </td>
                        <td className="num">
                          <strong>{formatDamage(row.damage)}</strong>
                          {row.source === "observed" ? (
                            <div className="muted small">
                              {m.formulaTag}{" "}
                              {formatDamage(row.formulaTraining)}
                            </div>
                          ) : null}
                        </td>
                        <td className="num">
                          {row.ratioOfBaseline.toFixed(3)}×
                        </td>
                        <td>
                          <div className="profession-bar-track">
                            <span
                              className="profession-bar"
                              style={{
                                width: `${Math.max(row.ratioOfBest * 100, 2)}%`,
                              }}
                            />
                          </div>
                          <div className="num muted small">
                            {formatRatio(row.ratioOfBest)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {compareResults.length < 2 ? null : (
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>{m.compareItem}</th>
                    {compareResults.map(({ profile }, index) => (
                      <th key={profile.id}>
                        <div className="compare-th">
                          <span>
                            {index === 0 ? (
                              <span className="baseline-tag">{m.baselineTag}</span>
                            ) : null}
                            {profile.name}
                          </span>
                          <span className="compare-th-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={index === 0}
                              onClick={() => moveCompare(profile.id, -1)}
                              title={m.moveLeft}
                              aria-label={m.moveLeftAria(profile.name)}
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={index === compareResults.length - 1}
                              onClick={() => moveCompare(profile.id, 1)}
                              title={m.moveRight}
                              aria-label={m.moveRightAria(profile.name)}
                            >
                              →
                            </button>
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{m.circuitScheme}</td>
                    {compareResults.map(({ profile }) => {
                      const scheme = profile.circuitSchemeId
                        ? schemesById.get(profile.circuitSchemeId)
                        : undefined;
                      return (
                        <td key={profile.id}>
                          {scheme ? scheme.name : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>{m.insigniaScheme}</td>
                    {compareResults.map(({ profile }) => {
                      const scheme = profile.insigniaSchemeId
                        ? insigniaSchemesById.get(profile.insigniaSchemeId)
                        : undefined;
                      return (
                        <td key={profile.id}>
                          {scheme ? scheme.name : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>{m.profession}</td>
                    {compareResults.map(({ profile }) => (
                      <td key={profile.id}>
                        {profile.professionId
                          ? professionNameLabel(
                              profile.professionId,
                              locale,
                              findProfession(
                                profile.professionId,
                                customProfessions,
                              )?.name,
                            )
                          : m.noProfessionShort}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{m.boundDamage}</td>
                    {compareResults.map(({ profile, result }) => {
                      const bound = configCompareDamage(
                        profile.observedTrainingDamage,
                        result.trainingDamage,
                      );
                      return (
                        <td key={profile.id} className="num">
                          {formatDamage(bound.value)}
                          <div className="muted small">
                            {bound.source === "observed"
                              ? m.observedTag
                              : m.formulaTag}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>{m.trainingDamage}</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {formatDamage(result.trainingDamage)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{m.trainingCompare}</td>
                    {compareResults.map(({ profile, result }) => {
                      const bound = configCompareDamage(
                        profile.observedTrainingDamage,
                        result.trainingDamage,
                      );
                      return (
                        <td key={profile.id} className="num">
                          {(bound.value / Math.max(baselineTraining, 1e-9)).toFixed(4)}×
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>{m.finalDamage}</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {formatDamage(result.finalDamage)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{m.dmgVsBaseline}</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {(result.finalDamage / baselineDamage).toFixed(4)}×
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{m.upliftVsThis}</td>
                    {compareResults.map(({ profile, result }) => {
                      const uplift =
                        (baselineDamage - result.finalDamage) /
                        Math.max(result.finalDamage, 1e-9);
                      return (
                        <td key={profile.id} className="num">
                          {formatRatio(uplift)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>{m.vsMonster}</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {formatDamage(result.vsMonster(monsterDef))}
                      </td>
                    ))}
                  </tr>
                  {(Object.keys(STAT_LABELS) as Array<keyof CombatStats>)
                    .filter((k) => k !== "attackPercent")
                    .map((key) => (
                      <tr key={key}>
                        <td>{statLabel(key)}</td>
                        {compareResults.map(({ profile, result }) => (
                          <td key={profile.id} className="num">
                            {formatStatValue(
                              key,
                              Number(result.effectiveStats[key] ?? 0),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="compare-picks">
            <h3>{m.quickPick}</h3>
            <div className="item-toggle-grid">
              {profiles.map((p) => (
                <label
                  key={p.id}
                  className={`item-toggle ${compareIds.includes(p.id) ? "on" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={compareIds.includes(p.id)}
                    onChange={() => toggleCompare(p.id)}
                  />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {formatDamage(
                        configCompareDamage(
                          p.observedTrainingDamage,
                          profileResult(p).trainingDamage,
                        ).value,
                      )}{" "}
                      {configCompareDamage(
                        p.observedTrainingDamage,
                        profileResult(p).trainingDamage,
                      ).source === "observed"
                        ? m.observedTag
                        : m.trainingChip}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="footer muted small">
        {m.footer(demoData.equipment.length)}
      </footer>
    </div>
  );
}

function InsigniaProfileGains({
  comparison,
}: {
  comparison: NonNullable<ReturnType<typeof compareSchemeInsignias>>;
}) {
  const { m } = useI18n();
  const maxAbs = Math.max(
    0,
    ...comparison.equipped.map((row) => Math.abs(row.delta)),
  );
  return (
    <div className="circuit-gain-list" style={{ marginTop: 12 }}>
      <p className="muted small">{m.insigniaMarginalHint}</p>
      {comparison.equipped.map((row) => {
        const width = maxAbs > 0 ? (Math.abs(row.delta) / maxAbs) * 100 : 0;
        const sign = row.delta > 0 ? "+" : row.delta < 0 ? "−" : "";
        const ratioSign = row.ratio > 0 ? "+" : row.ratio < 0 ? "−" : "";
        return (
          <div key={`${row.slot}-${row.piece.id}`} className="circuit-gain-row">
            <div className="circuit-gain-meta">
              <span className="circuit-gain-slot">{slotLabel(row.slot)}</span>
              <span className={`kind-pill ${row.piece.rarity}`}>
                {insigniaRarityLabel(row.piece.rarity)}
              </span>
              <span className="circuit-gain-name">
                {row.piece.name || defaultInsigniaName(row.piece)}
              </span>
            </div>
            <div className="circuit-gain-bar-track">
              <div
                className={`circuit-gain-bar kind-${row.piece.rarity} ${
                  row.delta < 0 ? "neg" : ""
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            <div
              className={`circuit-gain-nums ${
                row.delta > 0
                  ? "gain-pos"
                  : row.delta < 0
                    ? "gain-neg"
                    : "gain-zero"
              }`}
            >
              <span>
                {sign}
                {formatDamage(Math.abs(row.delta))}
              </span>
              <span>
                {ratioSign}
                {formatRatio(Math.abs(row.ratio))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;
