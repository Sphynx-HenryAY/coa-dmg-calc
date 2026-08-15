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
  calculateDamage,
  formatDamage,
  formatRatio,
  formatStatValue,
  makeId,
  resolveEffectiveStats,
} from "./lib/damage";
import type {
  CatalogItem,
  CircuitElement,
  CircuitPiece,
  CircuitScheme,
  CombatStats,
  Equipment,
  Profile,
  StatBag,
} from "./lib/types";
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
import {
  CIRCUIT_ELEMENT_LABEL,
  contributionLines,
  equippedCount,
  schemeContribution,
} from "./lib/circuit";
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

const MONSTER_DEFS = [
  { label: "訓練場 / 預設王 (14000)", value: 14000 },
  { label: "低防 (5000)", value: 5000 },
  { label: "中防 (20000)", value: 20000 },
  { label: "高防 (60000)", value: 60000 },
];

type Tab = "profiles" | "gear" | "items" | "circuits" | "compare";

function App() {
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
  const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // gear form (create / edit)
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [gearName, setGearName] = useState("");
  const [gearSlot, setGearSlot] = useState("項鍊");
  const [gearSet, setGearSet] = useState("自訂");
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
                  ? `分享配置已存在，已開啟：${resolved[0]!.name}`
                  : `分享的 ${resolved.length} 組配置均已存在，已開啟現有配置`;
            } else if (skipped === 0) {
              bootStatus =
                newProfiles.length === 1
                  ? `已從分享連結匯入配置：${newProfiles[0]!.name}`
                  : `已從分享連結匯入 ${newProfiles.length} 組配置`;
            } else {
              bootStatus = `已匯入 ${newProfiles.length} 組新配置；${skipped} 組已存在，已略過`;
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

  function profileResult(profile: Profile) {
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
    const effective = resolveEffectiveStats(profile.base, bags, profile.damageType);
    return calculateDamage(effective);
  }

  const activeResult = activeProfile ? profileResult(activeProfile) : null;
  const activeCircuitScheme = activeProfile?.circuitSchemeId
    ? schemesById.get(activeProfile.circuitSchemeId)
    : undefined;
  const activeCircuitLines = activeCircuitScheme
    ? contributionLines(
        schemeContribution(
          activeCircuitScheme,
          circuitsById,
          activeProfile?.element ?? "all",
          activeProfile?.damageType ?? "magic",
        ),
      )
    : null;

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
    [compareProfiles, allEquipment, allItems, circuits, circuitSchemes, monsterDef],
  );

  const baselineDamage = compareResults[0]?.result.finalDamage ?? activeResult?.finalDamage ?? 1;

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
    const p = blankProfile(`配置 ${profiles.length + 1}`);
    setProfiles((list) => [p, ...list]);
    setActiveProfileId(p.id);
    setTab("profiles");
    setStatus("已新增配置");
    scrollEditorIntoViewIfNarrow();
  }

  function duplicateProfile(profile: Profile): void {
    const copy: Profile = {
      ...structuredClone(profile),
      id: makeId("profile"),
      name: `${profile.name} (複製)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProfiles((list) => [copy, ...list]);
    setActiveProfileId(copy.id);
    setStatus("已複製配置");
    scrollEditorIntoViewIfNarrow();
  }

  async function copyShareUrl(
    url: string,
    label: string,
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("複製分享連結：", url);
    }
    const warn =
      url.length > SHARE_URL_WARN_LENGTH
        ? `（連結較長 ${url.length} 字，部分通訊軟體可能截斷）`
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
    return resolveEffectiveStats(profile.base, bags, profile.damageType);
  }

  /**
   * Share full profile(s): selected (比較) if any, else the active editing one.
   */
  async function shareProfilesFull(list: Profile[]): Promise<void> {
    if (list.length === 0) {
      setStatus("請先勾選「比較」或選擇要分享的配置");
      return;
    }
    try {
      const payload = buildSharePayload(
        list,
        equipmentById,
        itemsById,
        circuitsById,
        schemesById,
      );
      const fragment = await encodeShareFragment(payload);
      const url = buildShareUrl(fragment);
      const label =
        list.length === 1
          ? `已複製「${list[0]!.name}」完整分享連結`
          : `已複製 ${list.length} 組配置的完整分享連結`;
      await copyShareUrl(url, label);
    } catch {
      setStatus("產生分享連結失敗");
    }
  }

  /**
   * Share numeric stats only: selected (比較) if any, else the active editing one.
   */
  async function shareProfilesStats(list: Profile[]): Promise<void> {
    if (list.length === 0) {
      setStatus("請先勾選「比較」或選擇要分享的配置");
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
          ? `已複製「${list[0]!.name}」數值分享連結`
          : `已複製 ${list.length} 組配置的數值分享連結`;
      await copyShareUrl(url, label);
    } catch {
      setStatus("產生數值分享連結失敗");
    }
  }

  async function shareActiveProfile(): Promise<void> {
    if (!activeProfile) {
      setStatus("請先選擇要分享的配置");
      return;
    }
    await shareProfilesFull([activeProfile]);
  }

  async function shareActiveProfileStats(): Promise<void> {
    if (!activeProfile) {
      setStatus("請先選擇要分享的配置");
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

  function deleteProfile(id: string): void {
    setProfiles((list) => list.filter((p) => p.id !== id));
    setCompareIds((ids) => ids.filter((x) => x !== id));
    if (activeProfileId === id) {
      setActiveProfileId(profiles.find((p) => p.id !== id)?.id ?? null);
    }
    setStatus("已刪除配置");
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
    setGearSet("自訂");
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
    setGearSet(eq.set ?? "自訂");
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
      setStatus("請輸入裝備名稱");
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
      set: gearSet.trim() || "自訂",
      stats,
      statLines: lines.length ? lines : ["（無解析到的數值）"],
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
    setStatus(editingGearId ? `已更新裝備：${base.name}` : `已新增裝備：${base.name}`);
    resetGearForm();
  }

  function saveItemForm(): void {
    if (!itemName.trim()) {
      setStatus("請輸入道具名稱");
      return;
    }
    const { stats, lines } = parseStatLines(itemStats);
    const base: CatalogItem = {
      id: editingItemId ?? makeId("item"),
      name: itemName.trim(),
      kind: "item",
      stats,
      statLines: lines.length ? lines : ["（無解析到的數值）"],
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
    setStatus(editingItemId ? `已更新道具：${base.name}` : `已新增道具：${base.name}`);
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
    setStatus(`已刪除 ${ids.length} 件裝備`);
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
    setStatus(`已刪除 ${ids.length} 件道具`);
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
            ? `匯入失敗：${result.errors.slice(0, 3).join("；")}`
            : "匯入失敗：CSV 沒有有效列",
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
        ? `（${result.errors.length} 列略過）`
        : "";
      setStatus(
        `裝備匯入完成：新增 ${result.created.length}、更新 ${result.updated.length}${errNote}`,
      );
    } catch {
      setStatus("裝備 CSV 匯入失敗");
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
            ? `匯入失敗：${result.errors.slice(0, 3).join("；")}`
            : "匯入失敗：CSV 沒有有效列",
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
        ? `（${result.errors.length} 列略過）`
        : "";
      setStatus(
        `道具匯入完成：新增 ${result.created.length}、更新 ${result.updated.length}${errNote}`,
      );
    } catch {
      setStatus("道具 CSV 匯入失敗");
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
    setStatus("已匯出 JSON");
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
        hiddenEquipmentIds?: string[];
        hiddenItemIds?: string[];
        compareIds?: string[];
      };
      if (Array.isArray(data.profiles)) setProfiles(data.profiles);
      if (Array.isArray(data.customEquipment)) setCustomEquipment(data.customEquipment);
      if (Array.isArray(data.customItems)) setCustomItems(data.customItems);
      if (Array.isArray(data.circuits)) setCircuits(data.circuits);
      if (Array.isArray(data.circuitSchemes)) setCircuitSchemes(data.circuitSchemes);
      if (Array.isArray(data.hiddenEquipmentIds)) {
        setHiddenEquipmentIds(data.hiddenEquipmentIds);
      }
      if (Array.isArray(data.hiddenItemIds)) setHiddenItemIds(data.hiddenItemIds);
      if (Array.isArray(data.compareIds)) setCompareIds(data.compareIds);
      setStatus("匯入完成");
    } catch {
      setStatus("匯入失敗：JSON 格式錯誤");
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
        <p>載入中…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>COA 傷害計算機</h1>
          <p>
            依 <strong>siumai 傷害</strong> 分頁公式計算；從裝備庫、道具與迴路方案疊加屬性，建立多組
            Profile 並比較最終傷害。
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={addProfile}>
            新增配置
          </button>
          <button type="button" className="secondary" onClick={exportAll}>
            匯出
          </button>
          <label className="file-button">
            匯入
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

      <nav className="tabs" aria-label="主要分頁">
        {(
          [
            ["profiles", "配置 Profile", "配置"],
            ["gear", "裝備庫", "裝備"],
            ["items", "道具 / Buff", "道具"],
            ["circuits", "迴路配搭", "迴路"],
            ["compare", "傷害比較", "比較"],
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
              <h2>配置列表</h2>
              {compareIds.length > 0 ? (
                <div className="panel-heading-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void shareSelectedProfiles()}
                    title="分享已勾選「比較」的配置（含裝備/道具）"
                  >
                    分享選取完整 ({compareIds.length})
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void shareSelectedProfilesStats()}
                    title="分享已勾選「比較」的數值屬性"
                  >
                    分享選取數值 ({compareIds.length})
                  </button>
                </div>
              ) : null}
            </div>
            <p className="muted small">
              勾選「比較」可多選配置，再用上方按鈕一次分享全部選取項。
            </p>
            <div className="profile-list">
              {profiles.length === 0 ? (
                <p className="muted">尚無配置，點右上角新增。</p>
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
                            aria-label={`比較選取 ${p.name}`}
                          />
                          <span className="check-label-full">比較/選取</span>
                        </label>
                      </div>
                      <p className="muted small profile-card-note">
                        {p.note || "無備註"}
                      </p>
                      <div className="profile-card-meta">
                        <div className="dmg-chip">
                          <span className="dmg-chip-label">最終傷害 </span>
                          <strong>{formatDamage(res.finalDamage)}</strong>
                        </div>
                        <div className="card-actions profile-card-actions">
                          <button
                            type="button"
                            onClick={() => selectProfile(p.id)}
                            aria-label={`編輯 ${p.name}`}
                            title="編輯"
                          >
                            <span className="action-text">編輯</span>
                            <span className="action-icon" aria-hidden="true">
                              ✎
                            </span>
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => duplicateProfile(p)}
                            aria-label={`複製 ${p.name}`}
                            title="複製"
                          >
                            <span className="action-text">複製</span>
                            <span className="action-icon" aria-hidden="true">
                              ⧉
                            </span>
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => deleteProfile(p.id)}
                            aria-label={`刪除 ${p.name}`}
                            title="刪除"
                          >
                            <span className="action-text">刪除</span>
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
                  <h2>編輯：{activeProfile.name}</h2>
                  <div className="panel-heading-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void shareActiveProfile()}
                      title="僅分享目前編輯中的這一份配置（含其裝備/道具）"
                    >
                      分享完整
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void shareActiveProfileStats()}
                      title="僅分享目前編輯中的數值屬性"
                    >
                      分享數值
                    </button>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    名稱
                    <input
                      value={activeProfile.name}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    備註
                    <input
                      value={activeProfile.note}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, { note: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    傷害類型（影響物/魔暴擊、穿透、攻擊%）
                    <select
                      value={activeProfile.damageType}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          damageType: e.target.value as Profile["damageType"],
                        })
                      }
                    >
                      <option value="magic">魔法</option>
                      <option value="physical">物理</option>
                    </select>
                  </label>
                  <label>
                    技能屬性（決定迴路冰/火/電/暗是否計入屬強）
                    <select
                      value={activeProfile.element ?? "all"}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          element: e.target.value as CircuitElement | "all",
                        })
                      }
                    >
                      <option value="all">全部（所有屬性皆計入）</option>
                      <option value="ice">{CIRCUIT_ELEMENT_LABEL.ice}</option>
                      <option value="fire">{CIRCUIT_ELEMENT_LABEL.fire}</option>
                      <option value="electric">
                        {CIRCUIT_ELEMENT_LABEL.electric}
                      </option>
                      <option value="dark">{CIRCUIT_ELEMENT_LABEL.dark}</option>
                    </select>
                  </label>
                  <label>
                    迴路方案
                    <select
                      value={activeProfile.circuitSchemeId ?? ""}
                      onChange={(e) =>
                        updateProfile(activeProfile.id, {
                          circuitSchemeId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">— 未使用迴路 —</option>
                      {circuitSchemes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}（{equippedCount(s)}/11）
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <h3 className="section-title">基底數值</h3>
                <p className="muted small">
                  這些是<strong>未再加選裝備/道具前</strong>的基底數值，可再疊加裝備庫與道具。
                  比率類以<strong>百分比</strong>顯示（例如暴率 50 = 50%）。
                </p>
                <div className="stats-grid">
                  {BASE_FIELDS.map(({ key, step }) => {
                    const isPercent = PERCENT_STATS.has(key);
                    const stored = Number(activeProfile.base[key] ?? 0);
                    return (
                      <label key={key}>
                        {STAT_LABELS[key]}
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
                      </label>
                    );
                  })}
                </div>

                <h3 className="section-title">裝備欄位</h3>
                <div className="equip-grid">
                  {slotsInUse.map((slot) => {
                    const options = allEquipment.filter((e) => e.slot === slot);
                    if (options.length === 0) return null;
                    const current = activeProfile.equipped[slot] ?? "";
                    return (
                      <label key={slot}>
                        {slot}
                        <select
                          value={current}
                          onChange={(e) =>
                            equipSlot(slot, e.target.value || null)
                          }
                        >
                          <option value="">— 未裝備 —</option>
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

                <h3 className="section-title">迴路鑲嵌</h3>
                {activeCircuitScheme && activeCircuitLines ? (
                  <div className="circuit-profile-summary">
                    <p className="muted small">
                      目前方案：<strong>{activeCircuitScheme.name}</strong>（
                      {equippedCount(activeCircuitScheme)}/11）
                    </p>
                    {activeCircuitLines.damage.length > 0 ? (
                      <ul className="stat-lines">
                        {activeCircuitLines.damage.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">此方案尚無計入傷害的屬性。</p>
                    )}
                  </div>
                ) : (
                  <p className="muted small">
                    尚未套用迴路方案。到「迴路配搭」分頁新增迴路並套用，或在上方選擇方案。
                  </p>
                )}

                <h3 className="section-title">道具 / Buff</h3>
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

                <h3 className="section-title">計算結果</h3>
                <div className="result-panel">
                  <div className="result-main">
                    <div>
                      <span className="muted">最終傷害</span>
                      <div className="result-dmg">
                        {formatDamage(activeResult.finalDamage)}
                      </div>
                    </div>
                    <label>
                      怪防
                      <select
                        value={monsterDef}
                        onChange={(e) => setMonsterDef(Number(e.target.value))}
                      >
                        {MONSTER_DEFS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="muted">對怪有效傷害</span>
                      <div className="result-sub">
                        {formatDamage(activeResult.vsMonster(monsterDef))}
                      </div>
                    </div>
                  </div>

                  <h4>有效屬性</h4>
                  <dl className="stat-list">
                    {(Object.keys(STAT_LABELS) as Array<keyof CombatStats>).map(
                      (key) => {
                        if (key === "attackPercent" || key === "normalAttackDamage") {
                          const v = activeResult.effectiveStats[key] ?? 0;
                          if (!v) return null;
                        }
                        return (
                          <div key={key}>
                            <dt>{STAT_LABELS[key]}</dt>
                            <dd>
                              {formatStatValue(
                                key,
                                Number(activeResult.effectiveStats[key] ?? 0),
                              )}
                            </dd>
                          </div>
                        );
                      },
                    )}
                  </dl>

                  <h4>公式乘區</h4>
                  <dl className="stat-list compact">
                    {Object.entries(activeResult.factors).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{Number(v).toFixed(4)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="formula-note">
                    最終傷害 = (攻擊+破防) × (暴率×(1+爆傷)+(1−暴率)) × (1+屬強/220) ×
                    (1+技傷+共鳴) × (1+提傷) × (1+迴路) × (1+全屬性傷害) × (1+附加) ×
                    (1+異常+頭目) × (1+訓練場) × 技能倍率
                  </p>
                </div>
              </>
            ) : (
              <p className="muted">請選擇左側配置進行編輯。</p>
            )}
          </section>
        </div>
      )}

      {tab === "gear" && (
        <div className="layout-2">
          <section className="panel">
            <h2>{editingGearId ? "編輯裝備" : "新增裝備"}</h2>
            <p className="muted small">
              屬性格式（每行一項，也可用 <code>;</code> 分隔）：
              <code>技能傷害 +12%</code>、<code>全屬性強化 +28</code>
            </p>
            <div className="form-grid">
              <label>
                名稱
                <input
                  value={gearName}
                  onChange={(e) => setGearName(e.target.value)}
                  placeholder="例如：自訂 項鍊"
                />
              </label>
              <label>
                部位
                <select
                  value={gearSlot}
                  onChange={(e) => setGearSlot(e.target.value)}
                >
                  {slotsInUse.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="其他">其他</option>
                </select>
              </label>
              <label>
                套裝
                <input
                  value={gearSet}
                  onChange={(e) => setGearSet(e.target.value)}
                  placeholder="自訂 / 套裝名"
                />
              </label>
              <label>
                屬性（多行）
                <textarea
                  rows={6}
                  value={gearStats}
                  onChange={(e) => setGearStats(e.target.value)}
                  placeholder={"技能傷害 +12%\n全屬性強化 +28\n對頭目傷害 +11%"}
                />
              </label>
              <label>
                特效說明（選填，每行一則）
                <textarea
                  rows={3}
                  value={gearEffects}
                  onChange={(e) => setGearEffects(e.target.value)}
                  placeholder="特效文字…"
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={saveGearForm}>
                  {editingGearId ? "儲存變更" : "新增裝備"}
                </button>
                {editingGearId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetGearForm}
                  >
                    取消編輯
                  </button>
                ) : null}
              </div>
            </div>

            <h3 className="section-title">批次匯入 / 範本</h3>
            <p className="muted small">
              CSV 欄位：<code>id,name,slot,set,stats,effects</code>。
              有 <code>id</code> 且已存在則更新，否則新增。
              <code>stats</code> 用分號分隔多項屬性。
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("equipment-template.csv", GEAR_CSV_TEMPLATE)
                }
              >
                下載 CSV 範本
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("equipment-export.csv", equipmentToCsv(allEquipment))
                }
              >
                匯出目前裝備 CSV
              </button>
              <label className="file-button">
                批次匯入 CSV
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
              裝備庫{" "}
              <span className="muted small">
                ({filteredGear.length} / {allEquipment.length})
              </span>
            </h2>
            <p className="muted small">
              示範資料來自 Excel「acc set」+「裝備」。自訂 / 覆寫標 ★。可多選後批次刪除。
            </p>
            <div className="filter-row">
              <input
                placeholder="搜尋名稱 / 套裝 / 部位"
                value={gearFilter}
                onChange={(e) => setGearFilter(e.target.value)}
              />
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
              >
                <option value="all">全部部位</option>
                {slotsInUse.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
                全選目前列表
              </label>
              <span className="muted small">
                已選 {selectedGearIds.length} 件
              </span>
              <button
                type="button"
                className="danger"
                disabled={selectedGearIds.length === 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `確定刪除選取的 ${selectedGearIds.length} 件裝備？`,
                    )
                  ) {
                    deleteEquipmentIds(selectedGearIds);
                  }
                }}
              >
                刪除選取
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
                          編輯
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            if (window.confirm(`刪除「${e.name}」？`)) {
                              deleteEquipmentIds([e.id]);
                            }
                          }}
                        >
                          刪除
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
                        <summary>特效說明</summary>
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
            <h2>{editingItemId ? "編輯道具 / Buff" : "新增道具 / Buff"}</h2>
            <div className="form-grid">
              <label>
                名稱
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="例如：活動 Buff"
                />
              </label>
              <label>
                屬性（多行）
                <textarea
                  rows={5}
                  value={itemStats}
                  onChange={(e) => setItemStats(e.target.value)}
                  placeholder={"全屬性傷害 +17%\n附加傷害 +15%"}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={saveItemForm}>
                  {editingItemId ? "儲存變更" : "新增道具"}
                </button>
                {editingItemId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetItemForm}
                  >
                    取消編輯
                  </button>
                ) : null}
              </div>
            </div>

            <h3 className="section-title">批次匯入 / 範本</h3>
            <p className="muted small">
              CSV 欄位：<code>id,name,stats</code>。有 <code>id</code>{" "}
              且已存在則更新，否則新增。
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("items-template.csv", ITEM_CSV_TEMPLATE)
                }
              >
                下載 CSV 範本
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  downloadText("items-export.csv", itemsToCsv(allItems))
                }
              >
                匯出目前道具 CSV
              </button>
              <label className="file-button">
                批次匯入 CSV
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
              道具庫{" "}
              <span className="muted small">
                ({filteredItems.length} / {allItems.length})
              </span>
            </h2>
            <p className="muted small">
              示範項目來自 siumai 傷害註記。可編輯、多選刪除、CSV 批次匯入。
            </p>
            <div className="filter-row">
              <input
                placeholder="搜尋名稱 / 屬性"
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
                全選目前列表
              </label>
              <span className="muted small">
                已選 {selectedItemIds.length} 件
              </span>
              <button
                type="button"
                className="danger"
                disabled={selectedItemIds.length === 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `確定刪除選取的 ${selectedItemIds.length} 件道具？`,
                    )
                  ) {
                    deleteItemIds(selectedItemIds);
                  }
                }}
              >
                刪除選取
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
                          編輯
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            if (window.confirm(`刪除「${item.name}」？`)) {
                              deleteItemIds([item.id]);
                            }
                          }}
                        >
                          刪除
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
              setStatus("請先在「配置」分頁選擇一個配置");
              return;
            }
            updateProfile(activeProfile.id, { circuitSchemeId: schemeId });
          }}
          onStatus={setStatus}
          profileResult={profileResult}
        />
      )}

      {tab === "compare" && (
        <section className="panel wide">
          <h2>傷害比較</h2>
          <p className="muted">
            在配置列表勾選「比較」（最多 5 組）。列表<strong>第一個</strong>
            為基準，可用下方箭頭調整順序。
          </p>
          <div className="filter-row">
            <label className="inline-label">
              怪防
              <select
                value={monsterDef}
                onChange={(e) => setMonsterDef(Number(e.target.value))}
              >
                {MONSTER_DEFS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {compareProfiles.length > 0 ? (
            <div className="compare-order">
              <h3 className="section-title" style={{ marginTop: 0 }}>
                比較順序
              </h3>
              <ol className="compare-order-list">
                {compareProfiles.map((p, index) => (
                  <li key={p.id} className="compare-order-item">
                    <span className="compare-order-rank">
                      {index === 0 ? "基準" : index + 1}
                    </span>
                    <span className="compare-order-name">{p.name}</span>
                    <span className="muted small">
                      {formatDamage(profileResult(p).finalDamage)}
                    </span>
                    <div className="compare-order-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === 0}
                        onClick={() => moveCompare(p.id, -1)}
                        title="上移"
                        aria-label={`將 ${p.name} 上移`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === compareProfiles.length - 1}
                        onClick={() => moveCompare(p.id, 1)}
                        title="下移"
                        aria-label={`將 ${p.name} 下移`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === 0}
                        onClick={() => setCompareBaseline(p.id)}
                        title="設為基準（移到第一位）"
                      >
                        設為基準
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {compareResults.length < 2 ? (
            <p className="muted">請至少勾選 2 個配置。</p>
          ) : (
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>項目</th>
                    {compareResults.map(({ profile }, index) => (
                      <th key={profile.id}>
                        <div className="compare-th">
                          <span>
                            {index === 0 ? (
                              <span className="baseline-tag">基準 · </span>
                            ) : null}
                            {profile.name}
                          </span>
                          <span className="compare-th-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={index === 0}
                              onClick={() => moveCompare(profile.id, -1)}
                              title="左移"
                              aria-label={`將 ${profile.name} 左移`}
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={index === compareResults.length - 1}
                              onClick={() => moveCompare(profile.id, 1)}
                              title="右移"
                              aria-label={`將 ${profile.name} 右移`}
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
                    <td>迴路方案</td>
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
                    <td>最終傷害</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {formatDamage(result.finalDamage)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>傷害比較（相對基準）</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {(result.finalDamage / baselineDamage).toFixed(4)}×
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>提升%（基準相對此檔）</td>
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
                    <td>對怪有效傷害</td>
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
                        <td>{STAT_LABELS[key]}</td>
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
            <h3>快速勾選</h3>
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
                      {formatDamage(profileResult(p).finalDamage)} 傷害
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="footer muted small">
        公式來源：Excel「siumai 傷害」· 示範裝備：「acc set」{demoData.equipment.length}{" "}
        件（含裝備分頁）· 迴路主副屬與突破屬性（含迴路增傷）計入公式 · 本機 localStorage 儲存 · 可將配置嵌在 URL 分享
      </footer>
    </div>
  );
}

export default App;
