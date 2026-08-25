import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { mergeCatalog } from "../lib/catalog";
import { calculateDamage, makeId, resolveEffectiveStats } from "../lib/damage";
import type {
  CatalogItem,
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
  StatSource,
} from "../lib/types";
import { activeSourceIdsOf } from "../lib/types";
import {
  resolveProfession,
  upsertProfessionOverride,
  normalizeCustomProfession,
  normalizeProfessionOverride,
  applyProfessionCycle,
} from "../lib/profession";
import {
  getDemoEquipment,
  getDemoItems,
  hasStoredState,
  loadState,
  saveState,
  blankProfile,
} from "../lib/storage";
import { schemeContribution } from "../lib/circuit";
import {
  schemeContribution as insigniaSchemeContribution,
} from "../lib/insignia";
import {
  SHARE_URL_WARN_LENGTH,
  buildNumericSharePayload,
  buildSharePayload,
  buildShareUrl,
  clearShareHash,
  decodeShareFragment,
  encodeShareFragment,
  prepareShareImport,
} from "../lib/share";
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
} from "../lib/schemeShare";
import {
  professionNameLabel,
} from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";

export type Tab =
  | "profiles"
  | "gear"
  | "circuits"
  | "insignias"
  | "professions"
  | "compare"
  | "languages";

export type AppStoreValue = {
  ready: boolean;
  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;

  profiles: Profile[];
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
  customEquipment: Equipment[];
  setCustomEquipment: Dispatch<SetStateAction<Equipment[]>>;
  customItems: CatalogItem[];
  setCustomItems: Dispatch<SetStateAction<CatalogItem[]>>;
  compareIds: string[];
  setCompareIds: Dispatch<SetStateAction<string[]>>;
  activeProfileId: string | null;
  setActiveProfileId: Dispatch<SetStateAction<string | null>>;
  monsterDef: number;
  setMonsterDef: Dispatch<SetStateAction<number>>;
  status: string;
  setStatus: (msg: string) => void;
  hiddenEquipmentIds: string[];
  setHiddenEquipmentIds: Dispatch<SetStateAction<string[]>>;
  hiddenItemIds: string[];
  setHiddenItemIds: Dispatch<SetStateAction<string[]>>;
  circuits: CircuitPiece[];
  setCircuits: Dispatch<SetStateAction<CircuitPiece[]>>;
  circuitSchemes: CircuitScheme[];
  setCircuitSchemes: Dispatch<SetStateAction<CircuitScheme[]>>;
  insignias: InsigniaPiece[];
  setInsignias: Dispatch<SetStateAction<InsigniaPiece[]>>;
  insigniaSchemes: InsigniaScheme[];
  setInsigniaSchemes: Dispatch<SetStateAction<InsigniaScheme[]>>;
  professionOverrides: ProfessionOverride[];
  setProfessionOverrides: Dispatch<SetStateAction<ProfessionOverride[]>>;
  customProfessions: ProfessionDef[];
  setCustomProfessions: Dispatch<SetStateAction<ProfessionDef[]>>;

  demoEquipment: Equipment[];
  demoItems: CatalogItem[];
  allEquipment: Equipment[];
  allItems: CatalogItem[];
  equipmentById: Map<string, Equipment>;
  itemsById: Map<string, CatalogItem>;
  allSourcesById: Map<string, StatSource>;
  circuitsById: Map<string, CircuitPiece>;
  schemesById: Map<string, CircuitScheme>;
  insigniasById: Map<string, InsigniaPiece>;
  insigniaSchemesById: Map<string, InsigniaScheme>;
  activeProfile: Profile | null;

  editorPanelRef: RefObject<HTMLElement>;

  addProfile: () => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  deleteProfile: (id: string) => void;
  duplicateProfile: (profile: Profile) => void;
  selectProfile: (id: string) => void;
  toggleCompare: (id: string) => void;
  moveCompare: (id: string, delta: -1 | 1) => void;
  setCompareBaseline: (id: string) => void;

  applyProfessionToActive: (profession: ProfessionDef) => void;
  shareActiveProfile: () => Promise<void>;
  shareActiveProfileStats: () => Promise<void>;
  shareSelectedProfiles: () => Promise<void>;
  shareSelectedProfilesStats: () => Promise<void>;
  exportActiveProfileCircuitScheme: () => Promise<string>;
  exportActiveProfileInsigniaScheme: () => Promise<string>;
  importCircuitSchemeFromCode: (code: string) => Promise<void>;
  importInsigniaSchemeFromCode: (code: string) => Promise<void>;
  importSchemeOntoActiveProfile: (code: string) => Promise<void>;
  deleteCustomProfession: (id: string) => void;

  applyImportedCircuitScheme: (bundle: CircuitSchemeBundle) => Profile;
  applyImportedInsigniaScheme: (bundle: InsigniaSchemeBundle) => Profile;
  exportAll: () => void;
  importAll: (file: File) => Promise<void>;

  profileResult: (
    profile: Profile,
    schemeOverride?: CircuitScheme | null,
    insigniaOverride?: InsigniaScheme | null,
    extraProfessionOverrides?: ProfessionOverride[],
  ) => import("../lib/types").DamageResult;
  effectiveStatsFor: (profile: Profile) => CombatStats;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used within <AppStoreProvider>");
  }
  return ctx;
}

export function AppStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { locale, m } = useI18n();

  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customEquipment, setCustomEquipment] = useState<Equipment[]>([]);
  const [customItems, setCustomItems] = useState<CatalogItem[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profiles");
  const [monsterDef, setMonsterDef] = useState(14000);
  const [status, setStatus] = useState("");
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

  const allSourcesById = useMemo(() => {
    const map = new Map<string, StatSource>();
    for (const e of allEquipment) map.set(e.id, e as StatSource);
    for (const i of allItems) map.set(i.id, i as StatSource);
    return map;
  }, [allEquipment, allItems]);

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

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

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
            nextHiddenItemIds = nextHiddenItemIds.filter(
              (id) => !unhide.has(id),
            );
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
                  ? m.shareExistsOne(resolved[0]!.name)
                  : m.shareExistsMany(resolved.length);
            } else if (skipped === 0) {
              bootStatus =
                newProfiles.length === 1
                  ? m.shareImportedOne(newProfiles[0]!.name)
                  : m.shareImportedMany(newProfiles.length);
            } else {
              bootStatus = m.shareImportedPartial(newProfiles.length, skipped);
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

  const scrollEditorIntoViewIfNarrow = useCallback(() => {
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
  }, []);

  const collectSourceBags = useCallback(
    (profile: Profile): StatBag[] => {
      const ids = activeSourceIdsOf(profile);
      const occupied = new Set<string>();
      const bags: StatBag[] = [];
      for (const id of ids) {
        const src = allSourcesById.get(id);
        if (!src) continue;
        if (src.slot) {
          if (occupied.has(src.slot)) continue;
          occupied.add(src.slot);
        }
        bags.push(src.stats);
      }
      return bags;
    },
    [allSourcesById],
  );

  const profileResult = useCallback(
    (
      profile: Profile,
      schemeOverride?: CircuitScheme | null,
      insigniaOverride?: InsigniaScheme | null,
      extraProfessionOverrides?: ProfessionOverride[],
    ) => {
      const bags: StatBag[] = collectSourceBags(profile);
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
          overridesForResolve = upsertProfessionOverride(
            overridesForResolve,
            patch,
          );
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
      const effective = resolveEffectiveStats(
        profile.base,
        bags,
        profile.damageType,
      );
      const applied = applyProfessionCycle(effective, profession);
      return calculateDamage(applied.stats);
    },
    [
      collectSourceBags,
      schemesById,
      circuitsById,
      insigniaSchemesById,
      insigniasById,
      professionOverrides,
      customProfessions,
    ],
  );

  const effectiveStatsFor = useCallback(
    (profile: Profile): CombatStats => {
      const bags: StatBag[] = collectSourceBags(profile);
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
    },
    [
      collectSourceBags,
      schemesById,
      circuitsById,
      insigniaSchemesById,
      insigniasById,
    ],
  );

  const updateProfile = useCallback(
    (id: string, patch: Partial<Profile>) => {
      setProfiles((list) =>
        list.map((p) => {
          if (p.id !== id) return p;
          const next = { ...p, ...patch, updatedAt: new Date().toISOString() };
          next.activeSourceIds = activeSourceIdsOf(next);
          return next;
        }),
      );
    },
    [],
  );

  const applyProfessionToActive = useCallback(
    (profession: ProfessionDef) => {
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
    },
    [activeProfile, setStatus, updateProfile, locale, m],
  );

  const addProfile = useCallback(() => {
    const p = blankProfile(m.defaultProfileName(profiles.length + 1));
    setProfiles((list) => [p, ...list]);
    setActiveProfileId(p.id);
    setTab("profiles");
    setStatus(m.addedProfile);
    scrollEditorIntoViewIfNarrow();
  }, [profiles.length, m, scrollEditorIntoViewIfNarrow]);

  const copyShareUrl = useCallback(
    async (url: string, label: string) => {
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
    },
    [m],
  );

  const getSelectedProfiles = useCallback((): Profile[] => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return compareIds
      .map((id) => byId.get(id))
      .filter((p): p is Profile => p !== undefined);
  }, [profiles, compareIds]);

  const shareProfilesFull = useCallback(
    async (list: Profile[]) => {
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
    },
    [
      m,
      equipmentById,
      itemsById,
      circuitsById,
      schemesById,
      insigniasById,
      insigniaSchemesById,
      copyShareUrl,
    ],
  );

  const shareProfilesStats = useCallback(
    async (list: Profile[]) => {
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
    },
    [m, effectiveStatsFor, copyShareUrl],
  );

  const shareActiveProfile = useCallback(async () => {
    if (!activeProfile) {
      setStatus(m.shareNeedProfile);
      return;
    }
    await shareProfilesFull([activeProfile]);
  }, [activeProfile, shareProfilesFull, m]);

  const shareActiveProfileStats = useCallback(async () => {
    if (!activeProfile) {
      setStatus(m.shareNeedProfile);
      return;
    }
    await shareProfilesStats([activeProfile]);
  }, [activeProfile, shareProfilesStats, m]);

  const shareSelectedProfiles = useCallback(async () => {
    await shareProfilesFull(getSelectedProfiles());
  }, [shareProfilesFull, getSelectedProfiles]);

  const shareSelectedProfilesStats = useCallback(async () => {
    await shareProfilesStats(getSelectedProfiles());
  }, [shareProfilesStats, getSelectedProfiles]);

  const applyImportedCircuitScheme = useCallback(
    (bundle: CircuitSchemeBundle): Profile => {
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
    },
    [activeProfile, profiles.length, m],
  );

  const applyImportedInsigniaScheme = useCallback(
    (bundle: InsigniaSchemeBundle): Profile => {
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
    },
    [activeProfile, profiles.length, m],
  );

  const openProfileWithAppliedScheme = useCallback(
    (profile: Profile, message: string) => {
      setActiveProfileId(profile.id);
      setTab("profiles");
      setStatus(message);
      scrollEditorIntoViewIfNarrow();
    },
    [setStatus, scrollEditorIntoViewIfNarrow],
  );

  const importCircuitSchemeFromCode = useCallback(
    async (code: string) => {
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
    },
    [m, circuitSchemes, applyImportedCircuitScheme, openProfileWithAppliedScheme],
  );

  const importInsigniaSchemeFromCode = useCallback(
    async (code: string) => {
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
    },
    [
      m,
      insigniaSchemes,
      applyImportedInsigniaScheme,
      openProfileWithAppliedScheme,
    ],
  );

  const importSchemeOntoActiveProfile = useCallback(
    async (code: string) => {
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
    },
    [importCircuitSchemeFromCode, importInsigniaSchemeFromCode, m],
  );

  const exportActiveProfileCircuitScheme = useCallback(async (): Promise<string> => {
    if (!activeProfile?.circuitSchemeId) {
      throw new Error(m.noCircuitOnProfile);
    }
    const scheme = schemesById.get(activeProfile.circuitSchemeId);
    if (!scheme) throw new Error(m.noCircuitOnProfile);
    return encodeCircuitSchemeCode(scheme, circuitsById);
  }, [activeProfile, schemesById, circuitsById, m]);

  const exportActiveProfileInsigniaScheme = useCallback(
    async (): Promise<string> => {
      if (!activeProfile?.insigniaSchemeId) {
        throw new Error(m.noInsigniaOnProfile);
      }
      const scheme = insigniaSchemesById.get(activeProfile.insigniaSchemeId);
      if (!scheme) throw new Error(m.noInsigniaOnProfile);
      return encodeInsigniaSchemeCode(scheme, insigniasById);
    },
    [activeProfile, insigniaSchemesById, insigniasById, m],
  );

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return [...ids, id].slice(0, 5);
    });
  }, []);

  const moveCompare = useCallback((id: string, delta: -1 | 1) => {
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
  }, []);

  const setCompareBaseline = useCallback((id: string) => {
    setCompareIds((ids) => {
      if (!ids.includes(id) || ids[0] === id) return ids;
      return [id, ...ids.filter((x) => x !== id)];
    });
  }, []);

  const exportAll = useCallback(() => {
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
  }, [
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
    m,
  ]);

  const importAll = useCallback(async (file: File) => {
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
      if (Array.isArray(data.customEquipment))
        setCustomEquipment(data.customEquipment);
      if (Array.isArray(data.customItems)) setCustomItems(data.customItems);
      if (Array.isArray(data.circuits)) setCircuits(data.circuits);
      if (Array.isArray(data.circuitSchemes)) setCircuitSchemes(data.circuitSchemes);
      if (Array.isArray(data.insignias)) setInsignias(data.insignias);
      if (Array.isArray(data.insigniaSchemes))
        setInsigniaSchemes(data.insigniaSchemes);
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
  }, [m]);

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((list) => list.filter((p) => p.id !== id));
      setActiveProfileId(
        profiles.find((p) => p.id !== id)?.id ?? null,
      );
      setStatus(m.deletedProfile);
    },
    [profiles, m],
  );

  const duplicateProfile = useCallback(
    (profile: Profile) => {
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
    },
    [m, scrollEditorIntoViewIfNarrow],
  );

  const selectProfile = useCallback(
    (id: string) => {
      setActiveProfileId(id);
      scrollEditorIntoViewIfNarrow();
    },
    [scrollEditorIntoViewIfNarrow],
  );

  const deleteCustomProfession = useCallback((id: string) => {
    setProfiles((list) =>
      list.map((p) =>
        p.professionId === id ? { ...p, professionId: null } : p,
      ),
    );
  }, []);

  const value: AppStoreValue = {
    ready,
    tab,
    setTab,
    profiles,
    setProfiles,
    customEquipment,
    setCustomEquipment,
    customItems,
    setCustomItems,
    compareIds,
    setCompareIds,
    activeProfileId,
    setActiveProfileId,
    monsterDef,
    setMonsterDef,
    status,
    setStatus,
    hiddenEquipmentIds,
    setHiddenEquipmentIds,
    hiddenItemIds,
    setHiddenItemIds,
    circuits,
    setCircuits,
    circuitSchemes,
    setCircuitSchemes,
    insignias,
    setInsignias,
    insigniaSchemes,
    setInsigniaSchemes,
    professionOverrides,
    setProfessionOverrides,
    customProfessions,
    setCustomProfessions,

    demoEquipment,
    demoItems,
    allEquipment,
    allItems,
    equipmentById,
    itemsById,
    allSourcesById,
    circuitsById,
    schemesById,
    insigniasById,
    insigniaSchemesById,
    activeProfile,

    editorPanelRef,

    addProfile,
    updateProfile,
    deleteProfile,
    duplicateProfile,
    selectProfile,
    toggleCompare,
    moveCompare,
    setCompareBaseline,

    applyProfessionToActive,
    shareActiveProfile,
    shareActiveProfileStats,
    shareSelectedProfiles,
    shareSelectedProfilesStats,
    exportActiveProfileCircuitScheme,
    exportActiveProfileInsigniaScheme,
    importCircuitSchemeFromCode,
    importInsigniaSchemeFromCode,
    importSchemeOntoActiveProfile,
    deleteCustomProfession,

    applyImportedCircuitScheme,
    applyImportedInsigniaScheme,
    exportAll,
    importAll,

    profileResult,
    effectiveStatsFor,
  };

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}
