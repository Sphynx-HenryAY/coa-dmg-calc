import { useEffect, useMemo, useState } from "react";
import type {
  CircuitElement,
  CircuitKind,
  CircuitPiece,
  CircuitScheme,
  CircuitSlotId,
  CircuitStatKey,
  DamageResult,
  Profile,
} from "../lib/types";
import { formatDamage, formatRatio } from "../lib/damage";
import {
  CIRCUIT_BREAK_STATS,
  CIRCUIT_KIND_LABEL,
  CIRCUIT_MAIN_STATS,
  CIRCUIT_PERCENT_STATS,
  CIRCUIT_SLOT_DEFS,
  CIRCUIT_STAT_LABEL,
  CIRCUIT_SUB_STATS,
  assignCircuitToSlot,
  blankCircuitPiece,
  blankCircuitScheme,
  circuitInputValue,
  contributionLines,
  defaultCircuitName,
  defaultMainStat,
  detachCircuitsFromSchemes,
  equippedCount,
  formatAffix,
  isValidMainStat,
  parseCircuitInput,
  pieceStatLines,
  schemeContribution,
} from "../lib/circuit";

type SubDraft = { stat: CircuitStatKey | ""; value: number };

type CircuitTabProps = {
  circuits: CircuitPiece[];
  schemes: CircuitScheme[];
  setCircuits: React.Dispatch<React.SetStateAction<CircuitPiece[]>>;
  setSchemes: React.Dispatch<React.SetStateAction<CircuitScheme[]>>;
  activeProfile: Profile | null;
  onApplyScheme: (schemeId: string | null) => void;
  onStatus: (msg: string) => void;
  profileResult: (profile: Profile) => DamageResult;
};

const KIND_OPTIONS: CircuitKind[] = ["time", "nether", "star", "key"];

function emptyAffixRows(): SubDraft[] {
  return [
    { stat: "", value: 0 },
    { stat: "", value: 0 },
    { stat: "", value: 0 },
    { stat: "", value: 0 },
  ];
}

function fillAffixRows(list: CircuitPiece["subs"] | undefined): SubDraft[] {
  const next = emptyAffixRows();
  (list ?? []).slice(0, 4).forEach((affix, i) => {
    next[i] = { stat: affix.stat, value: affix.value };
  });
  return next;
}

function cleanAffixRows(rows: SubDraft[]): Array<{ stat: CircuitStatKey; value: number }> {
  const used = new Set<CircuitStatKey>();
  return rows
    .filter((s): s is { stat: CircuitStatKey; value: number } => {
      if (!s.stat) return false;
      if (used.has(s.stat)) return false;
      used.add(s.stat);
      return Number.isFinite(s.value);
    })
    .slice(0, 4);
}

export function CircuitTab({
  circuits,
  schemes,
  setCircuits,
  setSchemes,
  activeProfile,
  onApplyScheme,
  onStatus,
  profileResult,
}: CircuitTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CircuitKind>("time");
  const [mainStat, setMainStat] = useState<CircuitStatKey>("critRate");
  const [mainValue, setMainValue] = useState(0);
  const [subs, setSubs] = useState<SubDraft[]>(emptyAffixRows);
  const [breakthroughs, setBreakthroughs] = useState<SubDraft[]>(emptyAffixRows);
  const [kindFilter, setKindFilter] = useState<CircuitKind | "all">("all");
  const [search, setSearch] = useState("");
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(
    schemes[0]?.id ?? null,
  );

  const circuitsById = useMemo(() => {
    const map = new Map<string, CircuitPiece>();
    for (const c of circuits) map.set(c.id, c);
    return map;
  }, [circuits]);

  useEffect(() => {
    if (activeSchemeId && schemes.some((s) => s.id === activeSchemeId)) return;
    setActiveSchemeId(schemes[0]?.id ?? null);
  }, [schemes, activeSchemeId]);

  useEffect(() => {
    const id = activeProfile?.circuitSchemeId;
    if (id && schemes.some((s) => s.id === id)) setActiveSchemeId(id);
    // Only follow the profile when the selected profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  const activeScheme =
    schemes.find((s) => s.id === activeSchemeId) ?? null;

  const element: CircuitElement | "all" = activeProfile?.element ?? "all";

  const contrib = useMemo(() => {
    if (!activeScheme) return null;
    return schemeContribution(activeScheme, circuitsById, element);
  }, [activeScheme, circuitsById, element]);

  const contribText = contrib ? contributionLines(contrib) : null;

  const preview = useMemo(() => {
    if (!activeProfile) return null;
    const withScheme = profileResult({
      ...activeProfile,
      circuitSchemeId: activeScheme?.id ?? null,
    });
    const without = profileResult({
      ...activeProfile,
      circuitSchemeId: null,
    });
    return { withScheme, without };
  }, [activeProfile, activeScheme, profileResult]);

  const filteredCircuits = circuits.filter((c) => {
    if (kindFilter !== "all" && c.kind !== kindFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const label = (c.name || defaultCircuitName(c)).toLowerCase();
    const hay = [
      label,
      CIRCUIT_KIND_LABEL[c.kind],
      CIRCUIT_STAT_LABEL[c.main.stat],
      ...c.subs.map((s) => CIRCUIT_STAT_LABEL[s.stat]),
      ...(c.breakthroughs ?? []).map((s) => CIRCUIT_STAT_LABEL[s.stat]),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  function resetForm(): void {
    setEditingId(null);
    setName("");
    setKind("time");
    setMainStat("critRate");
    setMainValue(0);
    setSubs(emptyAffixRows());
    setBreakthroughs(emptyAffixRows());
  }

  function changeKind(next: CircuitKind): void {
    setKind(next);
    if (!isValidMainStat(next, mainStat)) {
      setMainStat(defaultMainStat(next));
      setMainValue(0);
    }
  }

  function startEdit(piece: CircuitPiece): void {
    setEditingId(piece.id);
    setName(piece.name);
    setKind(piece.kind);
    setMainStat(piece.main.stat);
    setMainValue(piece.main.value);
    setSubs(fillAffixRows(piece.subs));
    setBreakthroughs(fillAffixRows(piece.breakthroughs));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function savePiece(): void {
    const draft: CircuitPiece = {
      id: editingId ?? blankCircuitPiece(kind).id,
      name: name.trim(),
      kind,
      main: { stat: mainStat, value: mainValue },
      subs: cleanAffixRows(subs),
      breakthroughs: cleanAffixRows(breakthroughs),
      createdAt:
        circuits.find((c) => c.id === editingId)?.createdAt ??
        new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!draft.name) draft.name = defaultCircuitName(draft);

    setCircuits((list) => {
      const idx = list.findIndex((c) => c.id === draft.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = draft;
        return next;
      }
      return [draft, ...list];
    });
    onStatus(editingId ? `已更新迴路：${draft.name}` : `已新增迴路：${draft.name}`);
    resetForm();
  }

  function deletePiece(id: string): void {
    const piece = circuitsById.get(id);
    setCircuits((list) => list.filter((c) => c.id !== id));
    setSchemes((list) => detachCircuitsFromSchemes(list, [id]));
    if (editingId === id) resetForm();
    onStatus(`已刪除迴路：${piece?.name || id}`);
  }

  function addScheme(): void {
    const scheme = blankCircuitScheme(`方案 ${schemes.length + 1}`);
    setSchemes((list) => [scheme, ...list]);
    setActiveSchemeId(scheme.id);
    onStatus("已新增迴路方案");
  }

  function duplicateScheme(scheme: CircuitScheme): void {
    const copy: CircuitScheme = {
      ...structuredClone(scheme),
      id: blankCircuitScheme().id,
      name: `${scheme.name} (複製)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchemes((list) => [copy, ...list]);
    setActiveSchemeId(copy.id);
    onStatus("已複製迴路方案");
  }

  function deleteScheme(id: string): void {
    setSchemes((list) => list.filter((s) => s.id !== id));
    if (activeSchemeId === id) {
      setActiveSchemeId(schemes.find((s) => s.id !== id)?.id ?? null);
    }
    onStatus("已刪除迴路方案");
  }

  function patchScheme(id: string, patch: Partial<CircuitScheme>): void {
    setSchemes((list) =>
      list.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  }

  function equipSlot(slot: CircuitSlotId, circuitId: string | null): void {
    if (!activeScheme) return;
    setSchemes((list) =>
      list.map((s) =>
        s.id === activeScheme.id
          ? assignCircuitToSlot(s, slot, circuitId)
          : s,
      ),
    );
  }

  const usedInScheme = new Set(
    activeScheme
      ? Object.values(activeScheme.equipped).filter((x): x is string => !!x)
      : [],
  );

  const applied =
    !!activeProfile &&
    !!activeScheme &&
    activeProfile.circuitSchemeId === activeScheme.id;

  const usedSubStats = new Set(
    subs.map((s) => s.stat).filter((s): s is CircuitStatKey => !!s),
  );
  const usedBreakStats = new Set(
    breakthroughs.map((s) => s.stat).filter((s): s is CircuitStatKey => !!s),
  );

  return (
    <div className="layout-2">
      <section className="panel">
        <h2>{editingId ? "編輯迴路" : "新增迴路"}</h2>
        <p className="muted small">
          每件迴路 1 條主屬性 + 最多 4 條副屬性 + 最多 4 條突破屬性（30 等後解鎖）。
          時間只能裝頭/手/腳，冥燈裝上衣/褲子，星軌裝印章/護符，輝鑰裝武器/項鍊/護腕/戒指。
          突破裡的迴路增傷會進公式 (1+迴路)；全屬性傷害、全屬性強化、提傷、頭目、異常、技傷、暴率、暴傷、攻擊、力量智力也會計入。
          冰火電暗（副屬／星軌主屬）以屬強點數走 (1+屬強/220)，且需符合配置的技能屬性。
        </p>
        <div className="form-grid">
          <label>
            名稱
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="留空則依主屬性自動命名"
            />
          </label>
          <label>
            迴路種類
            <select
              value={kind}
              onChange={(e) => changeKind(e.target.value as CircuitKind)}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {CIRCUIT_KIND_LABEL[k]}（{slotHint(k)}）
                </option>
              ))}
            </select>
          </label>
          <label>
            主屬性
            <select
              value={mainStat}
              onChange={(e) => {
                const next = e.target.value as CircuitStatKey;
                setMainStat(next);
                setMainValue(0);
              }}
            >
              {CIRCUIT_MAIN_STATS[kind].map((s) => (
                <option key={s} value={s}>
                  {CIRCUIT_STAT_LABEL[s]}
                  {CIRCUIT_PERCENT_STATS.has(s) ? " (%)" : ""}
                  {s === "ice" || s === "fire" || s === "electric" || s === "dark"
                    ? " · 屬強點數"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            主屬性數值
            {CIRCUIT_PERCENT_STATS.has(mainStat) ? " (%)" : ""}
            <div
              className={
                CIRCUIT_PERCENT_STATS.has(mainStat) ? "input-with-suffix" : undefined
              }
            >
              <input
                type="number"
                step={CIRCUIT_PERCENT_STATS.has(mainStat) ? "0.1" : "1"}
                value={circuitInputValue(mainStat, mainValue)}
                onChange={(e) =>
                  setMainValue(parseCircuitInput(mainStat, e.target.value))
                }
              />
              {CIRCUIT_PERCENT_STATS.has(mainStat) ? (
                <span className="input-suffix">%</span>
              ) : null}
            </div>
          </label>
        </div>

        <h3 className="section-title">副屬性（最多 4 條，共通）</h3>
        <AffixRowList
          label="副屬性"
          rows={subs}
          options={CIRCUIT_SUB_STATS}
          used={usedSubStats}
          onChange={setSubs}
        />

        <h3 className="section-title">突破屬性（最多 4 條）</h3>
        <p className="muted small">
          迴路增傷、全屬性傷害、全屬性強化、技能傷害、傷害提升、頭目傷害、異常傷害、暴傷、暴率、冷卻、攻速、力量智力、敏捷精神、生命、攻擊力。
        </p>
        <AffixRowList
          label="突破"
          rows={breakthroughs}
          options={CIRCUIT_BREAK_STATS}
          used={usedBreakStats}
          onChange={setBreakthroughs}
        />

        <div className="form-actions">
          <button type="button" onClick={savePiece}>
            {editingId ? "儲存變更" : "新增迴路"}
          </button>
          {editingId ? (
            <button type="button" className="secondary" onClick={resetForm}>
              取消編輯
            </button>
          ) : null}
        </div>

        <h3 className="section-title">
          迴路庫{" "}
          <span className="muted small">
            ({filteredCircuits.length} / {circuits.length})
          </span>
        </h3>
        <div className="filter-row">
          <input
            placeholder="搜尋名稱 / 種類 / 主屬性"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as CircuitKind | "all")
            }
          >
            <option value="all">全部種類</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {CIRCUIT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="gear-list">
          {filteredCircuits.length === 0 ? (
            <p className="muted">尚無迴路，先在上方新增一條。</p>
          ) : (
            filteredCircuits.map((piece) => {
              const inUse = usedInScheme.has(piece.id);
              return (
                <article
                  key={piece.id}
                  className={`gear-card ${
                    editingId === piece.id ? "editing" : ""
                  } ${inUse ? "selected" : ""}`}
                >
                  <div className="gear-card-head">
                    <div className="gear-card-body">
                      <h3>
                        <span className={`kind-pill ${piece.kind}`}>
                          {CIRCUIT_KIND_LABEL[piece.kind]}
                        </span>{" "}
                        {piece.name || defaultCircuitName(piece)}
                      </h3>
                      <p className="muted small">
                        可裝：{slotHint(piece.kind)}
                        {inUse ? " · 目前方案使用中" : ""}
                      </p>
                    </div>
                    <div className="card-actions tight">
                      <button type="button" onClick={() => startEdit(piece)}>
                        編輯
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `刪除「${piece.name || defaultCircuitName(piece)}」？`,
                            )
                          ) {
                            deletePiece(piece.id);
                          }
                        }}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                  <ul className="stat-lines">
                    {pieceStatLines(piece).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>迴路方案</h2>
          <div className="panel-heading-actions">
            <button type="button" onClick={addScheme}>
              新增方案
            </button>
          </div>
        </div>
        <p className="muted small">
          11 件裝備各鑲 1 個迴路。多個配置可共用同一方案；改方案會同時影響所有套用它的配置。
        </p>

        {schemes.length === 0 ? (
          <p className="muted">尚無方案，點「新增方案」開始配搭。</p>
        ) : (
          <>
            <div className="form-grid">
              <label>
                目前編輯方案
                <select
                  value={activeSchemeId ?? ""}
                  onChange={(e) => setActiveSchemeId(e.target.value || null)}
                >
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}（{equippedCount(s)}/11）
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeScheme ? (
              <>
                <div className="form-grid">
                  <label>
                    方案名稱
                    <input
                      value={activeScheme.name}
                      onChange={(e) =>
                        patchScheme(activeScheme.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    備註
                    <input
                      value={activeScheme.note}
                      onChange={(e) =>
                        patchScheme(activeScheme.id, { note: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyScheme(activeScheme.id);
                      onStatus(
                        activeProfile
                          ? `已將「${activeScheme.name}」套用到 ${activeProfile.name}`
                          : "請先選擇一個配置",
                      );
                    }}
                    disabled={!activeProfile}
                  >
                    {applied ? "目前配置使用中" : "套用到目前配置"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => duplicateScheme(activeScheme)}
                  >
                    複製方案
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (window.confirm(`刪除方案「${activeScheme.name}」？`)) {
                        deleteScheme(activeScheme.id);
                      }
                    }}
                  >
                    刪除方案
                  </button>
                </div>

                <h3 className="section-title">
                  11 格鑲嵌{" "}
                  <span className="muted small">
                    {equippedCount(activeScheme)} / 11
                  </span>
                </h3>
                <div className="circuit-board">
                  {CIRCUIT_SLOT_DEFS.map((slot) => {
                    const currentId = activeScheme.equipped[slot.id] ?? "";
                    const options = circuits.filter((c) => c.kind === slot.kind);
                    const current = currentId
                      ? circuitsById.get(currentId)
                      : undefined;
                    return (
                      <label
                        key={slot.id}
                        className={`circuit-slot kind-${slot.kind} ${
                          current ? "filled" : ""
                        }`}
                      >
                        <span className="circuit-slot-head">
                          <span className="circuit-slot-name">{slot.id}</span>
                          <span className={`kind-pill ${slot.kind}`}>
                            {CIRCUIT_KIND_LABEL[slot.kind]}
                          </span>
                        </span>
                        <select
                          value={currentId}
                          onChange={(e) =>
                            equipSlot(slot.id, e.target.value || null)
                          }
                        >
                          <option value="">— 未鑲嵌 —</option>
                          {options.map((c) => {
                            const usedElsewhere =
                              usedInScheme.has(c.id) && c.id !== currentId;
                            return (
                              <option key={c.id} value={c.id}>
                                {c.name || defaultCircuitName(c)}
                                {usedElsewhere ? "（改裝至此）" : ""}
                              </option>
                            );
                          })}
                        </select>
                        {current ? (
                          <small className="circuit-slot-main">
                            {formatAffix(current.main)}
                            {current.subs.length
                              ? ` · 副 ${current.subs.length}`
                              : ""}
                            {(current.breakthroughs ?? []).length
                              ? ` · 突 ${(current.breakthroughs ?? []).length}`
                              : ""}
                          </small>
                        ) : (
                          <small className="muted">可裝 {slotHint(slot.kind)}</small>
                        )}
                      </label>
                    );
                  })}
                </div>

                <h3 className="section-title">方案加總（計入傷害公式）</h3>
                {contribText && contribText.damage.length > 0 ? (
                  <ul className="stat-lines">
                    {contribText.damage.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">尚未有可計入傷害的迴路屬性。</p>
                )}
                {contribText && contribText.extra.length > 0 ? (
                  <>
                    <p className="muted small" style={{ marginTop: 10 }}>
                      以下不在目前傷害公式乘區，僅作紀錄：
                    </p>
                    <ul className="stat-lines">
                      {contribText.extra.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {preview && activeProfile ? (
                  <div className="circuit-preview">
                    <div>
                      <span className="muted">目前配置（含此方案）</span>
                      <div className="result-sub">
                        {formatDamage(preview.withScheme.finalDamage)}
                      </div>
                    </div>
                    <div>
                      <span className="muted">不含迴路</span>
                      <div className="result-sub">
                        {formatDamage(preview.without.finalDamage)}
                      </div>
                    </div>
                    <div>
                      <span className="muted">迴路提升</span>
                      <div className="result-sub">
                        {formatRatio(
                          preview.without.finalDamage > 0
                            ? preview.withScheme.finalDamage /
                                preview.without.finalDamage -
                                1
                            : 0,
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="muted small">
                    選擇一個配置後，可即時預覽此方案對最終傷害的影響。
                  </p>
                )}
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function slotHint(kind: CircuitKind): string {
  return CIRCUIT_SLOT_DEFS.filter((s) => s.kind === kind)
    .map((s) => s.id)
    .join(" / ");
}

function AffixRowList({
  label,
  rows,
  options,
  used,
  onChange,
}: {
  label: string;
  rows: SubDraft[];
  options: CircuitStatKey[];
  used: Set<CircuitStatKey>;
  onChange: React.Dispatch<React.SetStateAction<SubDraft[]>>;
}) {
  return (
    <div className="circuit-subs">
      {rows.map((row, index) => (
        <div key={index} className="circuit-sub-row">
          <label>
            {label} {index + 1}
            <select
              value={row.stat}
              onChange={(e) => {
                const nextStat = e.target.value as CircuitStatKey | "";
                onChange((list) => {
                  const next = [...list];
                  next[index] = { stat: nextStat, value: 0 };
                  return next;
                });
              }}
            >
              <option value="">— 未使用 —</option>
              {options.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={used.has(s) && row.stat !== s}
                >
                  {CIRCUIT_STAT_LABEL[s]}
                  {CIRCUIT_PERCENT_STATS.has(s) ? " (%)" : ""}
                  {s === "elementalPower" ? " · 屬強點數" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            數值
            {row.stat && CIRCUIT_PERCENT_STATS.has(row.stat) ? " (%)" : ""}
            <div
              className={
                row.stat && CIRCUIT_PERCENT_STATS.has(row.stat)
                  ? "input-with-suffix"
                  : undefined
              }
            >
              <input
                type="number"
                step={
                  row.stat && CIRCUIT_PERCENT_STATS.has(row.stat) ? "0.1" : "1"
                }
                disabled={!row.stat}
                value={row.stat ? circuitInputValue(row.stat, row.value) : 0}
                onChange={(e) => {
                  if (!row.stat) return;
                  const parsed = parseCircuitInput(row.stat, e.target.value);
                  onChange((list) => {
                    const next = [...list];
                    next[index] = { ...next[index]!, value: parsed };
                    return next;
                  });
                }}
              />
              {row.stat && CIRCUIT_PERCENT_STATS.has(row.stat) ? (
                <span className="input-suffix">%</span>
              ) : null}
            </div>
          </label>
        </div>
      ))}
    </div>
  );
}
