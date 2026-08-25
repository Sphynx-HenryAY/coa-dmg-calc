import { useEffect, useMemo, useState } from "react";
import type {
  CircuitElement,
  CircuitKind,
  CircuitPiece,
  CircuitScheme,
  CircuitSlotId,
  CircuitStatKey,
} from "../lib/types";
import { formatDamage, formatRatio } from "../lib/damage";
import { formatSignedDamage, formatSignedRatio, gainClass } from "../lib/format";
import { parseStatInput, statInputValue } from "../lib/statInput";
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
  compareSchemeCircuits,
  contributionLines,
  defaultCircuitName,
  defaultMainStat,
  detachCircuitsFromSchemes,
  equippedCount,
  formatAffix,
  isValidMainStat,
  pieceStatLines,
  schemeContribution,
  slotHint,
  type CircuitSlotGain,
  type CircuitSwapGain,
} from "../lib/circuit";
import { CircuitScanPanel } from "./CircuitScanPanel";
import { SchemeShareBox } from "./SchemeShareBox";
import { AffixRowList } from "./forms";
import {
  inferKindFromMain,
  type CircuitParseResult,
} from "../lib/circuitParse";
import { encodeCircuitSchemeCode } from "../lib/schemeShare";
import {
  circuitKindLabel,
  circuitStatLabel,
  slotLabel,
} from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

type SubDraft = { stat: CircuitStatKey | ""; value: number };

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

function cleanAffixRows(
  rows: SubDraft[],
  opts?: { allowDuplicates?: boolean },
): Array<{ stat: CircuitStatKey; value: number }> {
  const used = new Set<CircuitStatKey>();
  return rows
    .filter((s): s is { stat: CircuitStatKey; value: number } => {
      if (!s.stat) return false;
      if (!opts?.allowDuplicates) {
        if (used.has(s.stat)) return false;
        used.add(s.stat);
      }
      return Number.isFinite(s.value);
    })
    .slice(0, 4);
}

export function CircuitTab() {
  const { locale, m } = useI18n();
  const {
    circuits,
    circuitSchemes: schemes,
    setCircuits,
    setCircuitSchemes: setSchemes,
    activeProfile,
    setStatus: onStatus,
    importCircuitSchemeFromCode: onImportShareCode,
    profileResult,
    updateProfile,
  } = useAppStore();

  const onApplyScheme = (schemeId: string | null) => {
    if (!activeProfile) {
      onStatus(m.pickProfileFirst);
      return;
    }
    updateProfile(activeProfile.id, { circuitSchemeId: schemeId });
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CircuitKind>("time");
  const [mainStat, setMainStat] = useState<CircuitStatKey>("critRate");
  const [mainValue, setMainValue] = useState(0);
  const [subs, setSubs] = useState<SubDraft[]>(emptyAffixRows);
  const [breakthroughs, setBreakthroughs] = useState<SubDraft[]>(emptyAffixRows);
  const [kindFilter, setKindFilter] = useState<CircuitKind | "all">("all");
  const [search, setSearch] = useState("");
  const [libSort, setLibSort] = useState<"default" | "gain">("default");
  const [gainMode, setGainMode] = useState<"marginal" | "solo">("marginal");
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
    const withScheme = profileResult(activeProfile, activeScheme);
    const without = profileResult(activeProfile, null);
    return { withScheme, without };
  }, [activeProfile, activeScheme, profileResult]);

  const comparison = useMemo(() => {
    if (!activeProfile || !activeScheme) return null;
    return compareSchemeCircuits(
      activeScheme,
      circuits,
      circuitsById,
      (scheme) => profileResult(activeProfile, scheme).finalDamage,
    );
  }, [activeProfile, activeScheme, circuits, circuitsById, profileResult]);

  const equippedGainById = useMemo(() => {
    const map = new Map<string, CircuitSlotGain>();
    if (!comparison) return map;
    for (const row of comparison.equipped) map.set(row.piece.id, row);
    return map;
  }, [comparison]);

  const filteredCircuits = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = circuits.filter((c) => {
      if (kindFilter !== "all" && c.kind !== kindFilter) return false;
      if (!q) return true;
      const label = (c.name || defaultCircuitName(c)).toLowerCase();
      const hay = [
        label,
        CIRCUIT_KIND_LABEL[c.kind],
        circuitKindLabel(c.kind),
        CIRCUIT_STAT_LABEL[c.main.stat],
        circuitStatLabel(c.main.stat),
        ...c.subs.flatMap((s) => [CIRCUIT_STAT_LABEL[s.stat], circuitStatLabel(s.stat)]),
        ...(c.breakthroughs ?? []).flatMap((s) => [
          CIRCUIT_STAT_LABEL[s.stat],
          circuitStatLabel(s.stat),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    if (libSort !== "gain" || !comparison) return list;
    return [...list].sort((a, b) => {
      const ga = librarySortValue(a.id, equippedGainById, comparison.byPieceId);
      const gb = librarySortValue(b.id, equippedGainById, comparison.byPieceId);
      return gb - ga;
    });
  }, [
    circuits,
    kindFilter,
    search,
    libSort,
    comparison,
    equippedGainById,
    locale,
  ]);

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
      breakthroughs: cleanAffixRows(breakthroughs, { allowDuplicates: true }),
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
    onStatus(editingId ? m.updatedCircuit(draft.name) : m.addedCircuit(draft.name));
    resetForm();
  }

  function applyScanToForm(result: CircuitParseResult): void {
    const nextKind = result.kind ?? kind;
    if (result.kind && result.kind !== kind) changeKind(result.kind);
    if (result.main) {
      if (isValidMainStat(nextKind, result.main.stat)) {
        setMainStat(result.main.stat);
        setMainValue(result.main.value);
      } else {
        const inferred = inferKindFromMain(result.main.stat);
        if (inferred) {
          changeKind(inferred);
          setMainStat(result.main.stat);
          setMainValue(result.main.value);
        }
      }
    }
    setSubs(fillAffixRows(result.subs));
    setBreakthroughs(fillAffixRows(result.breakthroughs));
    if (result.name) setName(result.name);
    onStatus(m.filledForm);
  }

  function addFromScan(result: CircuitParseResult): void {
    const nextKind =
      result.kind ??
      (result.main ? inferKindFromMain(result.main.stat) : null) ??
      kind;
    const main =
      result.main && isValidMainStat(nextKind, result.main.stat)
        ? result.main
        : { stat: defaultMainStat(nextKind), value: 0 };
    const draft: CircuitPiece = {
      id: blankCircuitPiece(nextKind).id,
      name: result.name.trim(),
      kind: nextKind,
      main,
      subs: result.subs,
      breakthroughs: result.breakthroughs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!draft.name) draft.name = defaultCircuitName(draft);
    setCircuits((list) => [draft, ...list]);
    onStatus(m.addedCircuit(draft.name));
    resetForm();
  }

  function deletePiece(id: string): void {
    const piece = circuitsById.get(id);
    setCircuits((list) => list.filter((c) => c.id !== id));
    setSchemes((list) => detachCircuitsFromSchemes(list, [id]));
    if (editingId === id) resetForm();
    onStatus(m.deletedCircuit(piece?.name || id));
  }

  function addScheme(): void {
    const scheme = blankCircuitScheme(m.defaultSchemeName(schemes.length + 1));
    setSchemes((list) => [scheme, ...list]);
    setActiveSchemeId(scheme.id);
    onStatus(m.addedCircuitScheme);
  }

  function duplicateScheme(scheme: CircuitScheme): void {
    const copy: CircuitScheme = {
      ...structuredClone(scheme),
      id: blankCircuitScheme().id,
      name: `${scheme.name}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchemes((list) => [copy, ...list]);
    setActiveSchemeId(copy.id);
    onStatus(m.copiedCircuitScheme);
  }

  function deleteScheme(id: string): void {
    setSchemes((list) => list.filter((s) => s.id !== id));
    if (activeSchemeId === id) {
      setActiveSchemeId(schemes.find((s) => s.id !== id)?.id ?? null);
    }
    onStatus(m.deletedCircuitScheme);
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

  async function exportActiveScheme(): Promise<string> {
    if (!activeScheme) throw new Error(m.pickSchemeToExport);
    return encodeCircuitSchemeCode(activeScheme, circuitsById);
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


  return (
    <div className="layout-2">
      <section className="panel">
        <h2>{editingId ? m.editCircuit : m.addCircuit}</h2>
        <p className="muted small">{m.circuitFormHint}</p>
        <CircuitScanPanel
          kindHint={kind}
          onApplyToForm={applyScanToForm}
          onAddDirectly={addFromScan}
          onStatus={onStatus}
        />
        <div className="form-grid">
          <label>
            {m.name}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={m.autoNamePh}
            />
          </label>
          <label>
            {m.circuitKind}
            <select
              value={kind}
              onChange={(e) => changeKind(e.target.value as CircuitKind)}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {m.kindWithSlots(circuitKindLabel(k), slotHint(k))}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.mainStat}
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
                  {circuitStatLabel(s)}
                  {CIRCUIT_PERCENT_STATS.has(s) ? " (%)" : ""}
                  {s === "ice" || s === "fire" || s === "electric" || s === "dark"
                    ? m.elemPoints
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.mainStatValue}
            {CIRCUIT_PERCENT_STATS.has(mainStat) ? " (%)" : ""}
            <div
              className={
                CIRCUIT_PERCENT_STATS.has(mainStat) ? "input-with-suffix" : undefined
              }
            >
              <input
                type="number"
                step={CIRCUIT_PERCENT_STATS.has(mainStat) ? "0.1" : "1"}
                value={statInputValue(mainStat, mainValue, CIRCUIT_PERCENT_STATS)}
                onChange={(e) =>
                  setMainValue(
                    parseStatInput(mainStat, e.target.value, CIRCUIT_PERCENT_STATS),
                  )
                }
              />
              {CIRCUIT_PERCENT_STATS.has(mainStat) ? (
                <span className="input-suffix">%</span>
              ) : null}
            </div>
          </label>
        </div>

        <h3 className="section-title">{m.subStatsTitle}</h3>
        <AffixRowList
          label={m.subStat}
          rows={subs}
          options={CIRCUIT_SUB_STATS}
          percentSet={CIRCUIT_PERCENT_STATS}
          labelFor={circuitStatLabel}
          suffixFor={(s) => (s === "elementalPower" ? m.elemPoints : "")}
          used={usedSubStats}
          onChange={setSubs}
        />

        <h3 className="section-title">{m.breakStatsTitle}</h3>
        <p className="muted small">{m.breakStatsHint}</p>
        <AffixRowList
          label={m.breakLabel}
          rows={breakthroughs}
          options={CIRCUIT_BREAK_STATS}
          percentSet={CIRCUIT_PERCENT_STATS}
          labelFor={circuitStatLabel}
          suffixFor={(s) => (s === "elementalPower" ? m.elemPoints : "")}
          allowDuplicates
          onChange={setBreakthroughs}
        />

        <div className="form-actions">
          <button type="button" onClick={savePiece}>
            {editingId ? m.saveChanges : m.addCircuit}
          </button>
          {editingId ? (
            <button type="button" className="secondary" onClick={resetForm}>
              {m.cancelEdit}
            </button>
          ) : null}
        </div>

        <h3 className="section-title">
          {m.circuitLib}{" "}
          <span className="muted small">
            ({filteredCircuits.length} / {circuits.length})
          </span>
        </h3>
        <div className="filter-row">
          <input
            placeholder={m.searchCircuits}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as CircuitKind | "all")
            }
          >
            <option value="all">{m.allKinds}</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {circuitKindLabel(k)}
              </option>
            ))}
          </select>
          <select
            value={libSort}
            onChange={(e) =>
              setLibSort(e.target.value as "default" | "gain")
            }
          >
            <option value="default">{m.sortDefault}</option>
            <option value="gain">{m.sortGain}</option>
          </select>
        </div>
        <div className="gear-list">
          {filteredCircuits.length === 0 ? (
            <p className="muted">{m.noCircuits}</p>
          ) : (
            filteredCircuits.map((piece) => {
              const inUse = usedInScheme.has(piece.id);
              const swap = comparison?.byPieceId.get(piece.id);
              const equippedGain = equippedGainById.get(piece.id);
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
                          {circuitKindLabel(piece.kind)}
                        </span>{" "}
                        {piece.name || defaultCircuitName(piece)}
                      </h3>
                      <p className="muted small">
                        {m.canSocket(slotHint(piece.kind))}
                        {inUse ? m.inUseScheme : ""}
                      </p>
                      {activeProfile ? (
                        <LibraryGainNote
                          inUse={inUse}
                          swap={swap}
                          equippedGain={equippedGain}
                        />
                      ) : null}
                    </div>
                    <div className="card-actions tight">
                      <button type="button" onClick={() => startEdit(piece)}>
                        {m.edit}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              m.confirmDeleteNamed(
                                piece.name || defaultCircuitName(piece),
                              ),
                            )
                          ) {
                            deletePiece(piece.id);
                          }
                        }}
                      >
                        {m.delete}
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
          <h2>{m.circuitSchemes}</h2>
          <div className="panel-heading-actions">
            <button type="button" onClick={addScheme}>
              {m.addScheme}
            </button>
          </div>
        </div>
        <p className="muted small">{m.circuitSchemeHint}</p>

        <SchemeShareBox
          kind="circuit"
          canExport={!!activeScheme}
          exportDisabledReason={m.exportNeedScheme}
          onExport={exportActiveScheme}
          onImport={onImportShareCode}
          onStatus={onStatus}
        />

        {schemes.length === 0 ? (
          <p className="muted">{m.noSchemes}</p>
        ) : (
          <>
            <div className="form-grid">
              <label>
                {m.editingScheme}
                <select
                  value={activeSchemeId ?? ""}
                  onChange={(e) => setActiveSchemeId(e.target.value || null)}
                >
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {m.schemeCount(s.name, equippedCount(s))}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeScheme ? (
              <>
                <div className="form-grid">
                  <label>
                    {m.schemeName}
                    <input
                      value={activeScheme.name}
                      onChange={(e) =>
                        patchScheme(activeScheme.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {m.note}
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
                          ? m.appliedSchemeTo(activeScheme.name, activeProfile.name)
                          : m.pickAProfile,
                      );
                    }}
                    disabled={!activeProfile}
                  >
                    {applied ? m.appliedNow : m.applyToProfile}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => duplicateScheme(activeScheme)}
                  >
                    {m.copyScheme}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (window.confirm(m.confirmDeleteScheme(activeScheme.name))) {
                        deleteScheme(activeScheme.id);
                      }
                    }}
                  >
                    {m.deleteScheme}
                  </button>
                </div>

                <h3 className="section-title">
                  {m.sockets11}{" "}
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
                          <span className="circuit-slot-name">{slotLabel(slot.id)}</span>
                          <span className={`kind-pill ${slot.kind}`}>
                            {circuitKindLabel(slot.kind)}
                          </span>
                        </span>
                        <select
                          value={currentId}
                          onChange={(e) =>
                            equipSlot(slot.id, e.target.value || null)
                          }
                        >
                          <option value="">{m.unsocketed}</option>
                          {options.map((c) => {
                            const usedElsewhere =
                              usedInScheme.has(c.id) && c.id !== currentId;
                            return (
                              <option key={c.id} value={c.id}>
                                {c.name || defaultCircuitName(c)}
                                {usedElsewhere ? m.moveHere : ""}
                              </option>
                            );
                          })}
                        </select>
                        {current ? (
                          <small className="circuit-slot-main">
                            {formatAffix(current.main)}
                            {current.subs.length
                              ? m.subCount(current.subs.length)
                              : ""}
                            {(current.breakthroughs ?? []).length
                              ? m.breakCount((current.breakthroughs ?? []).length)
                              : ""}
                            {equippedGainById.has(current.id) ? (
                              <>
                                {" · "}
                                <span
                                  className={gainClass(
                                    equippedGainById.get(current.id)!.delta,
                                  )}
                                >
                                  {formatSignedRatio(
                                    equippedGainById.get(current.id)!.ratio,
                                  )}
                                </span>
                              </>
                            ) : null}
                          </small>
                        ) : (
                          <small className="muted">{m.canFit(slotHint(slot.kind))}</small>
                        )}
                      </label>
                    );
                  })}
                </div>

                <h3 className="section-title">{m.schemeTotal}</h3>
                {contribText && contribText.damage.length > 0 ? (
                  <ul className="stat-lines">
                    {contribText.damage.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{m.noCircuitDamage}</p>
                )}
                {contribText && contribText.extra.length > 0 ? (
                  <>
                    <p className="muted small" style={{ marginTop: 10 }}>
                      {m.extraNotInFormula}
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
                      <span className="muted">{m.previewWithScheme}</span>
                      <div className="result-sub">
                        {formatDamage(preview.withScheme.finalDamage)}
                      </div>
                    </div>
                    <div>
                      <span className="muted">{m.previewNoCircuit}</span>
                      <div className="result-sub">
                        {formatDamage(preview.without.finalDamage)}
                      </div>
                    </div>
                    <div>
                      <span className="muted">{m.previewCircuitGain}</span>
                      <div className="result-sub">
                        {formatSignedRatio(
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
                    {m.previewNeedProfile}
                  </p>
                )}

                {activeProfile && comparison && comparison.equipped.length > 0 ? (
                  <CircuitGainPanel
                    comparison={comparison}
                    gainMode={gainMode}
                    onGainMode={setGainMode}
                  />
                ) : activeProfile && activeScheme && equippedCount(activeScheme) === 0 ? (
                  <p className="muted small">{m.socketToCompare}</p>
                ) : !activeProfile ? (
                  <p className="muted small">
                    {m.pickProfileToCompare}
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function librarySortValue(
  pieceId: string,
  equipped: Map<string, CircuitSlotGain>,
  swaps: Map<string, CircuitSwapGain>,
): number {
  const row = equipped.get(pieceId);
  if (row) return row.delta;
  return swaps.get(pieceId)?.delta ?? Number.NEGATIVE_INFINITY;
}

function LibraryGainNote({
  inUse,
  swap,
  equippedGain,
}: {
  inUse: boolean;
  swap?: CircuitSwapGain;
  equippedGain?: CircuitSlotGain;
}) {
  const { m } = useI18n();
  if (inUse && equippedGain) {
    return (
      <p className={`circuit-lib-gain ${gainClass(equippedGain.delta)}`}>
        {m.schemeContrib(
          formatSignedDamage(equippedGain.delta),
          formatSignedRatio(equippedGain.ratio),
        )}
      </p>
    );
  }
  if (!swap) return null;
  const action =
    swap.action === "add"
      ? m.addToSlot(slotLabel(swap.slot))
      : swap.action === "swap"
        ? m.swapToSlot(slotLabel(swap.slot))
        : m.keepSlot(slotLabel(swap.slot));
  return (
    <p className={`circuit-lib-gain ${gainClass(swap.delta)}`}>
      {action} {formatSignedDamage(swap.delta)}（{formatSignedRatio(swap.ratio)}）
    </p>
  );
}

function CircuitGainPanel({
  comparison,
  gainMode,
  onGainMode,
}: {
  comparison: NonNullable<ReturnType<typeof compareSchemeCircuits>>;
  gainMode: "marginal" | "solo";
  onGainMode: (mode: "marginal" | "solo") => void;
}) {
  const { m } = useI18n();
  const rows = [...comparison.equipped].sort((a, b) => {
    const va = gainMode === "solo" ? a.soloDelta : a.delta;
    const vb = gainMode === "solo" ? b.soloDelta : b.delta;
    return vb - va;
  });
  const maxAbs = Math.max(
    0,
    ...rows.map((r) => Math.abs(gainMode === "solo" ? r.soloDelta : r.delta)),
  );

  return (
    <div className="circuit-gain-panel">
      <h3 className="section-title">{m.circuitGainTitle}</h3>
      <p className="muted small">{m.circuitGainHint}</p>
      <div className="circuit-gain-modes" role="group" aria-label={m.gainAlgoAria}>
        <button
          type="button"
          className={gainMode === "marginal" ? "tab active" : "tab"}
          onClick={() => onGainMode("marginal")}
        >
          {m.marginal}
        </button>
        <button
          type="button"
          className={gainMode === "solo" ? "tab active" : "tab"}
          onClick={() => onGainMode("solo")}
        >
          {m.solo}
        </button>
      </div>
      <div className="circuit-gain-list">
        {rows.map((row) => {
          const value = gainMode === "solo" ? row.soloDelta : row.delta;
          const ratio = gainMode === "solo" ? row.soloRatio : row.ratio;
          const width = maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0;
          return (
            <div key={`${row.slot}-${row.piece.id}`} className="circuit-gain-row">
              <div className="circuit-gain-meta">
                <span className="circuit-gain-slot">{slotLabel(row.slot)}</span>
                <span className={`kind-pill ${row.piece.kind}`}>
                  {circuitKindLabel(row.piece.kind)}
                </span>
                <span className="circuit-gain-name">
                  {row.piece.name || defaultCircuitName(row.piece)}
                </span>
              </div>
              <div className="circuit-gain-bar-track">
                <div
                  className={`circuit-gain-bar kind-${row.piece.kind} ${
                    value < 0 ? "neg" : ""
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className={`circuit-gain-nums ${gainClass(value)}`}>
                <span>{formatSignedDamage(value)}</span>
                <span>{formatSignedRatio(ratio)}</span>
                {gainMode === "marginal" ? (
                  <span className="muted">
                    {m.shareOfSet(formatRatio(Math.abs(row.shareOfTotal)))}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


