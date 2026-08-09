import { useEffect, useMemo, useState } from "react";
import "./App.css";
import demoData from "./data/demoData.json";
import {
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
  loadState,
  saveState,
} from "./lib/storage";

const BASE_FIELDS: Array<{ key: keyof CombatStats; step?: string }> = [
  { key: "attack" },
  { key: "defenseBreak" },
  { key: "critRate", step: "0.001" },
  { key: "critDamage", step: "0.001" },
  { key: "elementalPower", step: "0.1" },
  { key: "skillDamage", step: "0.001" },
  { key: "resonance", step: "0.001" },
  { key: "damageBoost", step: "0.001" },
  { key: "circuitBoost", step: "0.001" },
  { key: "allElementDamage", step: "0.001" },
  { key: "additionalDamage", step: "0.001" },
  { key: "statusDamage", step: "0.001" },
  { key: "bossDamage", step: "0.001" },
  { key: "penetration", step: "0.001" },
  { key: "trainingCorrection", step: "0.001" },
  { key: "skillMultiplier", step: "0.01" },
];

const MONSTER_DEFS = [
  { label: "訓練場 / 預設王 (14000)", value: 14000 },
  { label: "低防 (5000)", value: 5000 },
  { label: "中防 (20000)", value: 20000 },
  { label: "高防 (60000)", value: 60000 },
];

type Tab = "profiles" | "gear" | "items" | "compare";

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

  // custom gear form
  const [newGearName, setNewGearName] = useState("");
  const [newGearSlot, setNewGearSlot] = useState("項鍊");
  const [newGearStats, setNewGearStats] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemStats, setNewItemStats] = useState("");

  const demoEquipment = useMemo(() => getDemoEquipment(), []);
  const demoItems = useMemo(() => getDemoItems(), []);

  const allEquipment = useMemo(
    () => [...demoEquipment, ...customEquipment],
    [demoEquipment, customEquipment],
  );
  const allItems = useMemo(
    () => [...demoItems, ...customItems],
    [demoItems, customItems],
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

  useEffect(() => {
    const state = loadState();
    setProfiles(state.profiles);
    setCustomEquipment(state.customEquipment);
    setCustomItems(state.customItems);
    setCompareIds(state.compareIds);
    setActiveProfileId(state.activeProfileId);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState({
      profiles,
      customEquipment,
      customItems,
      compareIds,
      activeProfileId,
    });
  }, [ready, profiles, customEquipment, customItems, compareIds, activeProfileId]);

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
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
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
    const effective = resolveEffectiveStats(profile.base, bags, profile.damageType);
    return calculateDamage(effective);
  }

  const activeResult = activeProfile ? profileResult(activeProfile) : null;

  const compareProfiles = useMemo(
    () => profiles.filter((p) => compareIds.includes(p.id)),
    [profiles, compareIds],
  );

  const compareResults = useMemo(
    () =>
      compareProfiles.map((p) => ({
        profile: p,
        result: profileResult(p),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compareProfiles, allEquipment, allItems, monsterDef],
  );

  const baselineDamage = compareResults[0]?.result.finalDamage ?? activeResult?.finalDamage ?? 1;

  function addProfile(): void {
    const p = blankProfile(`配置 ${profiles.length + 1}`);
    setProfiles((list) => [p, ...list]);
    setActiveProfileId(p.id);
    setTab("profiles");
    setStatus("已新增配置");
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

  function parseStatLines(text: string): { stats: StatBag; lines: string[] } {
    const stats: StatBag = {};
    const lines: string[] = [];
    const map: Record<string, keyof StatBag> = {
      攻擊: "attack",
      破防: "defenseBreak",
      暴率: "critRate",
      暴擊: "critRate",
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
    };

    for (const rawLine of text.split(/\n|;|；/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(/^(.+?)\s*[+:：]?\s*([-+]?[\d.]+)\s*(%|％)?$/);
      if (!m) continue;
      const label = m[1].trim().replace(/%$/, "");
      const num = Number(m[2]);
      const isPct = Boolean(m[3]);
      const key = map[label];
      if (!key || !Number.isFinite(num)) continue;
      let value = num;
      if (isPct || (key !== "attack" && key !== "defenseBreak" && key !== "elementalPower" && key !== "skillMultiplier" && Math.abs(num) > 1.5 && key !== "cooldownSpeed" && key !== "attackSpeed")) {
        // if user typed 12% or bare 12 for a percent-ish field, convert
        if (isPct) value = num / 100;
        else if (
          key !== "attack" &&
          key !== "defenseBreak" &&
          key !== "elementalPower" &&
          key !== "skillMultiplier" &&
          Math.abs(num) > 1.5
        ) {
          value = num / 100;
        }
      }
      const prev = (stats[key] as number | undefined) ?? 0;
      (stats as Record<string, number>)[key] = prev + value;
      lines.push(line);
    }
    return { stats, lines };
  }

  function addCustomGear(): void {
    if (!newGearName.trim()) {
      setStatus("請輸入裝備名稱");
      return;
    }
    const { stats, lines } = parseStatLines(newGearStats);
    const eq: Equipment = {
      id: makeId("gear"),
      name: newGearName.trim(),
      slot: newGearSlot,
      set: "自訂",
      stats,
      statLines: lines.length ? lines : ["（無解析到的數值）"],
      effects: [],
      source: "custom",
      demo: false,
    };
    setCustomEquipment((list) => [eq, ...list]);
    setNewGearName("");
    setNewGearStats("");
    setStatus(`已新增裝備：${eq.name}`);
    setTab("gear");
  }

  function addCustomItem(): void {
    if (!newItemName.trim()) {
      setStatus("請輸入道具名稱");
      return;
    }
    const { stats, lines } = parseStatLines(newItemStats);
    const item: CatalogItem = {
      id: makeId("item"),
      name: newItemName.trim(),
      kind: "item",
      stats,
      statLines: lines.length ? lines : ["（無解析到的數值）"],
      demo: false,
    };
    setCustomItems((list) => [item, ...list]);
    setNewItemName("");
    setNewItemStats("");
    setStatus(`已新增道具：${item.name}`);
    setTab("items");
  }

  function deleteCustomGear(id: string): void {
    setCustomEquipment((list) => list.filter((e) => e.id !== id));
    setProfiles((list) =>
      list.map((p) => {
        const equipped = { ...p.equipped };
        for (const [slot, eqId] of Object.entries(equipped)) {
          if (eqId === id) equipped[slot] = null;
        }
        return { ...p, equipped };
      }),
    );
    setStatus("已刪除自訂裝備");
  }

  function deleteCustomItem(id: string): void {
    setCustomItems((list) => list.filter((i) => i.id !== id));
    setProfiles((list) =>
      list.map((p) => ({
        ...p,
        itemIds: p.itemIds.filter((x) => x !== id),
      })),
    );
    setStatus("已刪除自訂道具");
  }

  function exportAll(): void {
    const blob = new Blob(
      [
        JSON.stringify(
          { profiles, customEquipment, customItems, compareIds },
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
        compareIds?: string[];
      };
      if (Array.isArray(data.profiles)) setProfiles(data.profiles);
      if (Array.isArray(data.customEquipment)) setCustomEquipment(data.customEquipment);
      if (Array.isArray(data.customItems)) setCustomItems(data.customItems);
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
            依 <strong>siumai 傷害</strong> 分頁公式計算；從 acc set / 裝備庫選擇配件，建立多組
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

      <nav className="tabs">
        {(
          [
            ["profiles", "配置 Profile"],
            ["gear", "裝備庫"],
            ["items", "道具 / Buff"],
            ["compare", "傷害比較"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
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
            <h2>配置列表</h2>
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
                          onClick={() => setActiveProfileId(p.id)}
                        >
                          <h3>{p.name}</h3>
                        </button>
                        <label className="check-inline">
                          <input
                            type="checkbox"
                            checked={inCompare}
                            onChange={() => toggleCompare(p.id)}
                          />
                          比較
                        </label>
                      </div>
                      <p className="muted small">{p.note || "無備註"}</p>
                      <div className="dmg-chip">
                        最終傷害{" "}
                        <strong>{formatDamage(res.finalDamage)}</strong>
                      </div>
                      <div className="card-actions">
                        <button type="button" onClick={() => setActiveProfileId(p.id)}>
                          編輯
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => duplicateProfile(p)}
                        >
                          複製
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => deleteProfile(p.id)}
                        >
                          刪除
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel">
            {activeProfile && activeResult ? (
              <>
                <h2>編輯：{activeProfile.name}</h2>
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
                </div>

                <h3 className="section-title">基底數值</h3>
                <p className="muted small">
                  這些是<strong>未再加選裝備/道具前</strong>的數值。Excel 基準檔已含完整配裝；
                  「空白組裝檔」適合從基底再疊加裝備庫。
                </p>
                <div className="stats-grid">
                  {BASE_FIELDS.map(({ key, step }) => (
                    <label key={key}>
                      {STAT_LABELS[key]}
                      <input
                        type="number"
                        step={step ?? "1"}
                        value={activeProfile.base[key] ?? 0}
                        onChange={(e) => updateBaseStat(key, e.target.value)}
                      />
                    </label>
                  ))}
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
            <h2>新增自訂裝備</h2>
            <p className="muted small">
              數值格式範例（每行一項）：
              <code>技能傷害 +12%</code>、<code>全屬性強化 +28</code>、
              <code>暴擊傷害 +20%</code>
            </p>
            <div className="form-grid">
              <label>
                名稱
                <input
                  value={newGearName}
                  onChange={(e) => setNewGearName(e.target.value)}
                  placeholder="例如：自訂 項鍊"
                />
              </label>
              <label>
                部位
                <select
                  value={newGearSlot}
                  onChange={(e) => setNewGearSlot(e.target.value)}
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
                屬性（多行）
                <textarea
                  rows={6}
                  value={newGearStats}
                  onChange={(e) => setNewGearStats(e.target.value)}
                  placeholder={"技能傷害 +12%\n全屬性強化 +28\n對頭目傷害 +11%"}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={addCustomGear}>
                  新增裝備
                </button>
              </div>
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
              示範資料來自 Excel「acc set」四套飾品 + 「裝備」分頁。自訂裝備標 ★。
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
            <div className="gear-list">
              {filteredGear.map((e) => (
                <article key={e.id} className="gear-card">
                  <div className="gear-card-head">
                    <div>
                      <h3>
                        {e.name}
                        {!e.demo ? " ★" : ""}
                      </h3>
                      <p className="muted small">
                        {e.slot}
                        {e.set ? ` · ${e.set}` : ""}
                        {e.source ? ` · ${e.source}` : ""}
                      </p>
                    </div>
                    {!e.demo ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteCustomGear(e.id)}
                      >
                        刪除
                      </button>
                    ) : null}
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
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "items" && (
        <div className="layout-2">
          <section className="panel">
            <h2>新增自訂道具 / Buff</h2>
            <div className="form-grid">
              <label>
                名稱
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="例如：活動 Buff"
                />
              </label>
              <label>
                屬性（多行）
                <textarea
                  rows={5}
                  value={newItemStats}
                  onChange={(e) => setNewItemStats(e.target.value)}
                  placeholder={"全屬性傷害 +17%\n附加傷害 +15%"}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={addCustomItem}>
                  新增道具
                </button>
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>道具庫</h2>
            <p className="muted small">
              示範項目來自 siumai 傷害分頁註記（銘刻 / 熱水器 / 龍 / 迴路 等）。
            </p>
            <div className="gear-list">
              {allItems.map((item) => (
                <article key={item.id} className="gear-card">
                  <div className="gear-card-head">
                    <div>
                      <h3>
                        {item.name}
                        {!item.demo ? " ★" : ""}
                      </h3>
                    </div>
                    {!item.demo ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteCustomItem(item.id)}
                      >
                        刪除
                      </button>
                    ) : null}
                  </div>
                  <ul className="stat-lines">
                    {item.statLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "compare" && (
        <section className="panel wide">
          <h2>傷害比較</h2>
          <p className="muted">
            在配置列表勾選「比較」（最多 5 組）。第一個勾選的配置作為基準計算提升%。
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

          {compareResults.length < 2 ? (
            <p className="muted">請至少勾選 2 個配置。</p>
          ) : (
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>項目</th>
                    {compareResults.map(({ profile }) => (
                      <th key={profile.id}>{profile.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
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
        件（含裝備分頁）· 本機 localStorage 儲存
      </footer>
    </div>
  );
}

export default App;
