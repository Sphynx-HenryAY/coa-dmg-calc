import React, { useEffect, useMemo, useState } from "react";
import type {
  CircuitElement,
  DamageResult,
  Profile,
  StatBag,
} from "../lib/types";
import type { SchemeShareKind } from "../lib/schemeShare";
import type { LoadoutSlotGain, LoadoutSwapGain } from "../lib/loadout";
import { formatDamage, formatRatio } from "../lib/damage";
import {
  formatSignedDamage,
  formatSignedRatio,
  gainClass,
} from "../lib/format";
import { AffixRowList, type AffixDraft } from "./forms";
import { slotLabel } from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { SchemeShareBox } from "./SchemeShareBox";

export type LibSort = "default" | "gain";

/** A scheme as far as the shared UI needs to know about it. */
export interface SchemeLike<S extends string> {
  id: string;
  name: string;
  note: string;
  equipped: Partial<Record<S, string | null>>;
}

export interface SlotOption {
  id: string;
  label: string;
  gainText: string;
}

export interface SlotCtx<P extends { id: string }, S extends string, Comp> {
  comparison: Comp | null;
  equippedGainById: Map<string, LoadoutSlotGain<P, S>>;
  piecesById: Map<string, P>;
  usedInScheme: Set<string>;
}

export interface AffixBlockConfig<Draft> {
  title: string;
  hint?: string;
  rowLabel: string;
  options: string[];
  percentSet: Set<string>;
  labelFor: (s: string) => string;
  suffixFor?: (s: string) => string;
  allowDuplicates?: boolean;
  rowHeader?: (i: number) => string;
  getRows: (d: Draft) => AffixDraft<string>[];
  setRows: (d: Draft, rows: AffixDraft<string>[]) => Draft;
}

/**
 * Describes one domain (Circuit or Insignia) to the generic LoadoutTab.
 * Every behavioural difference between the two tabs is expressed as a
 * parameter or callback here; the shared UI lives entirely in LoadoutTab.
 */
export interface LoadoutConfig<
  P extends { id: string },
  Sch extends SchemeLike<S>,
  S extends string,
  K,
  Draft,
  Extra,
  Comp extends {
    equipped: LoadoutSlotGain<P, S>[];
    byPieceId: Map<string, LoadoutSwapGain<S>>;
  },
> {
  // ---- titles / static messages ----
  formTitle: (editing: boolean) => string;
  formHint: string;
  addLabel: string;
  namePlaceholder: string;
  libTitle: string;
  noLibMsg: string;
  libraryTitle?: string;
  searchPlaceholder: string;
  schemesTitle: string;
  schemesHint: string;
  noSchemesMsg: string;
  schemes: Sch[];
  pieces: P[];
  piecesById: Map<string, P>;
  contribEmptyMsg: string;
  schemeShareKind: SchemeShareKind;
  gainTitle: string;
  gainHintWith: string;
  gainHintEmpty: string;
  equippedHeader?: string;
  emptyHint?: string;
  previewNoLabel: string;
  previewGainLabel: string;

  // ---- form ----
  blankDraft: () => Draft;
  loadDraft: (piece: P) => Draft;
  onSave: (draft: Draft, editingId: string | null) => void;
  getName: (d: Draft) => string;
  setName: (d: Draft, name: string) => Draft;
  deletePiece: (id: string) => void;
  exportActiveScheme: (scheme: Sch) => Promise<string>;
  onImportShareCode: (code: string) => Promise<void>;
  renderScan?: (
    draft: Draft,
    setDraft: React.Dispatch<React.SetStateAction<Draft>>,
  ) => React.ReactNode;
  renderFields: (
    draft: Draft,
    setDraft: React.Dispatch<React.SetStateAction<Draft>>,
  ) => React.ReactNode;
  affixBlocks: AffixBlockConfig<Draft>[];

  // ---- library ----
  pieceStatLines: (piece: P) => string[];
  cardPills: (piece: P) => React.ReactNode;
  cardCanSocket: (piece: P) => string;
  cardNote?: (piece: P) => string | undefined;
  extraCardActions?: (piece: P) => React.ReactNode;
  renderFilterSelects: () => React.ReactNode;
  applyFilters: (
    pieces: P[],
    ctx: { search: string; libSort: LibSort; comparison: Comp | null },
  ) => P[];

  // ---- scheme editor ----
  schemeOptionLabel: (scheme: Sch) => string;
  isApplied: (profile: Profile | null, schemeId: string) => boolean;
  getProfileSchemeId: (profile: Profile | null) => string | null;
  applyToProfile: (schemeId: string | null) => void;
  addScheme: () => string;
  duplicateScheme: (scheme: Sch) => string;
  deleteScheme: (id: string) => void;
  patchScheme: (id: string, patch: Partial<Sch>) => void;
  equippedCount: (scheme: Sch) => number;
  schemeContribution: (
    scheme: Sch,
    piecesById: Map<string, P>,
    element: CircuitElement | "all",
  ) => { bag: StatBag; extra: Extra };
  contributionLines: (contrib: {
    bag: StatBag;
    extra: Extra;
  }) => { damage: string[]; extra: string[] };
  computeComparison: (
    scheme: Sch | null,
    activeProfile: Profile | null,
  ) => Comp | null;
  computePreview: (
    scheme: Sch | null,
    activeProfile: Profile,
  ) => { withScheme: DamageResult; without: DamageResult };
  shouldShowGainPanel: (
    activeProfile: Profile | null,
    comparison: Comp | null,
    activeScheme: Sch | null,
  ) => boolean;
  /** Shown (instead of the gain panel) when shouldShowGainPanel is false. */
  gainFallback?: (
    activeProfile: Profile | null,
    activeScheme: Sch | null,
  ) => React.ReactNode;

  // ---- socket board ----
  slotDefs: Array<{ id: S; kind?: K }>;
  slotFilledClass: (current: P | undefined) => string;
  slotPill: (slot: S, current: P | undefined) => React.ReactNode;
  slotOptions: (
    slot: S,
    currentId: string,
    ctx: SlotCtx<P, S, Comp>,
  ) => SlotOption[];
  slotBody: (
    slot: S,
    current: P,
    ctx: SlotCtx<P, S, Comp>,
  ) => React.ReactNode;
  emptySlotHint: (slot: S, optionCount: number) => string;
  equipSlot: (schemeId: string, slot: S, id: string | null) => void;

  // ---- gain panel ----
  gainRowMeta: (
    row: LoadoutSlotGain<P, S>,
  ) => { pillClass: string; pillLabel: string; name: string };
  libraryGain?: {
    rowMeta: (
      pieceId: string,
      piecesById: Map<string, P>,
    ) => { pillClass: string; pillLabel: string; name: string };
  };
}

export function LoadoutTab<
  P extends { id: string },
  Sch extends SchemeLike<S>,
  S extends string,
  K,
  Draft,
  Extra,
  Comp extends {
    equipped: LoadoutSlotGain<P, S>[];
    byPieceId: Map<string, LoadoutSwapGain<S>>;
  },
>({ config }: { config: LoadoutConfig<P, Sch, S, K, Draft, Extra, Comp> }): React.JSX.Element {
  const { m } = useI18n();
  const { activeProfile, setStatus } = useAppStore();
  const onStatus = setStatus;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => config.blankDraft());
  const [search, setSearch] = useState("");
  const [libSort, setLibSort] = useState<LibSort>("default");
  const [gainMode, setGainMode] = useState<"marginal" | "solo">("marginal");
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(
    config.schemes[0]?.id ?? null,
  );

  useEffect(() => {
    if (
      activeSchemeId &&
      config.schemes.some((s) => s.id === activeSchemeId)
    )
      return;
    setActiveSchemeId(config.schemes[0]?.id ?? null);
  }, [config.schemes, activeSchemeId]);

  useEffect(() => {
    const id = config.getProfileSchemeId(activeProfile);
    if (id && config.schemes.some((s) => s.id === id)) {
      setActiveSchemeId(id);
    }
    // Only follow the profile when the selected profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  const activeScheme =
    config.schemes.find((s) => s.id === activeSchemeId) ?? null;

  const element: CircuitElement | "all" = activeProfile?.element ?? "all";

  const comparison = useMemo<Comp | null>(() => {
    if (!activeProfile) return null;
    return config.computeComparison(activeScheme, activeProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile, activeScheme, config.pieces, config.piecesById, config]);

  const equippedGainById = useMemo(() => {
    const map = new Map<string, LoadoutSlotGain<P, S>>();
    if (!comparison) return map;
    for (const row of comparison.equipped) map.set(row.piece.id, row);
    return map;
  }, [comparison]);

  const filteredPieces = useMemo<P[]>(() => {
    return config.applyFilters(config.pieces, { search, libSort, comparison });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, search, libSort, comparison]);

  const contrib = useMemo(() => {
    if (!activeScheme) return null;
    return config.schemeContribution(activeScheme, config.piecesById, element);
  }, [activeScheme, config.piecesById, element, config]);

  const contribText = contrib ? config.contributionLines(contrib) : null;

  const preview = useMemo(() => {
    if (!activeProfile) return null;
    return config.computePreview(activeScheme, activeProfile);
  }, [activeProfile, activeScheme, config]);

  const usedInScheme = new Set(
    activeScheme
      ? Object.values(activeScheme.equipped).filter(
          (x): x is string => !!x,
        )
      : [],
  );

  function resetForm(): void {
    setEditingId(null);
    setDraft(config.blankDraft());
  }

  function startEdit(piece: P): void {
    setEditingId(piece.id);
    setDraft(config.loadDraft(piece));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const slotCtx: SlotCtx<P, S, Comp> = {
    comparison,
    equippedGainById,
    piecesById: config.piecesById,
    usedInScheme,
  };

  return (
    <div className="layout-2">
      <section className="panel">
        <h2>{config.formTitle(!!editingId)}</h2>
        <p className="muted small">{config.formHint}</p>
        {config.renderScan?.(draft, setDraft)}
        <div className="form-grid">
          <label>
            {m.name}
            <input
              value={config.getName(draft)}
              onChange={(e) => setDraft(config.setName(draft, e.target.value))}
              placeholder={config.namePlaceholder}
            />
          </label>
          {config.renderFields(draft, setDraft)}
        </div>

        {config.affixBlocks.map((block, bi) => (
          <div key={bi}>
            <h3 className="section-title">{block.title}</h3>
            {block.hint ? <p className="muted small">{block.hint}</p> : null}
            <AffixRowList
              label={block.rowLabel}
              rows={block.getRows(draft)}
              options={block.options}
              percentSet={block.percentSet}
              labelFor={block.labelFor}
              suffixFor={block.suffixFor}
              rowHeader={block.rowHeader}
              used={
                new Set(
                  block
                    .getRows(draft)
                    .map((r) => r.stat)
                    .filter((s): s is string => !!s),
                )
              }
              allowDuplicates={block.allowDuplicates}
              onChange={(next) => {
                const rows =
                  typeof next === "function"
                    ? (
                        next as (
                          prev: AffixDraft<string>[],
                        ) => AffixDraft<string>[]
                      )(block.getRows(draft))
                    : next;
                setDraft(block.setRows(draft, rows));
              }}
            />
          </div>
        ))}

        <div className="form-actions">
          <button
            type="button"
            onClick={() => {
              config.onSave(draft, editingId);
              resetForm();
            }}
          >
            {editingId ? m.saveChanges : config.addLabel}
          </button>
          {editingId ? (
            <button type="button" className="secondary" onClick={resetForm}>
              {m.cancelEdit}
            </button>
          ) : null}
        </div>

        <h3 className="section-title">
          {config.libTitle}{" "}
          <span className="muted small">
            ({filteredPieces.length} / {config.pieces.length})
          </span>
        </h3>
        <div className="filter-row">
          <input
            placeholder={config.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {config.renderFilterSelects()}
          <select
            value={libSort}
            onChange={(e) => setLibSort(e.target.value as LibSort)}
          >
            <option value="default">{m.sortDefault}</option>
            <option value="gain">{m.sortGain}</option>
          </select>
        </div>
        <div className="gear-list">
          {filteredPieces.length === 0 ? (
            <p className="muted">{config.noLibMsg}</p>
          ) : (
            filteredPieces.map((piece) => {
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
                        {config.cardPills(piece)}{" "}
                        {config.getName(config.loadDraft(piece))}
                      </h3>
                      <p className="muted small">
                        {config.cardCanSocket(piece)}
                        {inUse ? m.inUseScheme : ""}
                      </p>
                      {config.cardNote?.(piece) ? (
                        <p className="muted small">{config.cardNote(piece)}</p>
                      ) : null}
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
                      {config.extraCardActions?.(piece)}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              m.confirmDeleteNamed(
                                config.getName(config.loadDraft(piece)),
                              ),
                            )
                          ) {
                            config.deletePiece(piece.id);
                          }
                        }}
                      >
                        {m.delete}
                      </button>
                    </div>
                  </div>
                  <ul className="stat-lines">
                    {config.pieceStatLines(piece).map((line) => (
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
          <h2>{config.schemesTitle}</h2>
          <div className="panel-heading-actions">
            <button
              type="button"
              onClick={() => setActiveSchemeId(config.addScheme())}
            >
              {m.addScheme}
            </button>
          </div>
        </div>
        <p className="muted small">{config.schemesHint}</p>

        <SchemeShareBox
          kind={config.schemeShareKind}
          canExport={!!activeScheme}
          exportDisabledReason={m.exportNeedScheme}
          onExport={() =>
            activeScheme
              ? config.exportActiveScheme(activeScheme)
              : Promise.reject(new Error(m.pickSchemeToExport))
          }
          onImport={config.onImportShareCode}
          onStatus={onStatus}
        />

        {config.schemes.length === 0 ? (
          <>
            <p className="muted">{config.noSchemesMsg}</p>
            {config.shouldShowGainPanel(activeProfile, comparison, null) ? (
              <GainPanel
                comparison={comparison!}
                piecesById={config.piecesById}
                gainMode={gainMode}
                setGainMode={setGainMode}
                hasScheme={false}
                gainTitle={config.gainTitle}
                gainHintWith={config.gainHintWith}
                gainHintEmpty={config.gainHintEmpty}
                equippedHeader={config.equippedHeader}
                emptyHint={config.emptyHint}
                gainRowMeta={config.gainRowMeta}
                libraryGain={config.libraryGain}
                libraryTitle={config.libraryTitle}
              />
            ) : (
              <>{config.gainFallback?.(activeProfile, null)}</>
            )}
          </>
        ) : (
          <>
            <div className="form-grid">
              <label>
                {m.editingScheme}
                <select
                  value={activeSchemeId ?? ""}
                  onChange={(e) => setActiveSchemeId(e.target.value || null)}
                >
                  {config.schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {config.schemeOptionLabel(s)}
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
                        config.patchScheme(activeScheme.id, {
                          name: e.target.value,
                        } as Partial<Sch>)
                      }
                    />
                  </label>
                  <label>
                    {m.note}
                    <input
                      value={activeScheme.note}
                      onChange={(e) =>
                        config.patchScheme(activeScheme.id, {
                          note: e.target.value,
                        } as Partial<Sch>)
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      config.applyToProfile(activeScheme.id);
                      onStatus(
                        activeProfile
                          ? m.appliedSchemeTo(
                              activeScheme.name,
                              activeProfile.name,
                            )
                          : m.pickAProfile,
                      );
                    }}
                    disabled={!activeProfile}
                  >
                    {config.isApplied(activeProfile, activeScheme.id)
                      ? m.appliedNow
                      : m.applyToProfile}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setActiveSchemeId(config.duplicateScheme(activeScheme))
                    }
                  >
                    {m.copyScheme}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          m.confirmDeleteScheme(activeScheme.name),
                        )
                      ) {
                        config.deleteScheme(activeScheme.id);
                      }
                    }}
                  >
                    {m.deleteScheme}
                  </button>
                </div>

                <h3 className="section-title">
                  {m.sockets11}{" "}
                  <span className="muted small">
                    {config.equippedCount(activeScheme)} / 11
                  </span>
                </h3>
                <div className="circuit-board">
                  {config.slotDefs.map((slotDef) => {
                    const slot = slotDef.id;
                    const currentId = activeScheme.equipped[slot] ?? "";
                    const options = config.slotOptions(
                      slot,
                      currentId,
                      slotCtx,
                    );
                    const current = currentId
                      ? config.piecesById.get(currentId)
                      : undefined;
                    return (
                      <label
                        key={slot}
                        className={`circuit-slot ${config.slotFilledClass(
                          current,
                        )}`}
                      >
                        <span className="circuit-slot-head">
                          <span className="circuit-slot-name">
                            {slotLabel(slot)}
                          </span>
                          {config.slotPill(slot, current)}
                        </span>
                        <select
                          value={currentId}
                          onChange={(e) =>
                            config.equipSlot(
                              activeScheme.id,
                              slot,
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">{m.unsocketed}</option>
                          {options.map((opt) => {
                            const usedElsewhere =
                              usedInScheme.has(opt.id) && opt.id !== currentId;
                            return (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                                {opt.gainText}
                                {usedElsewhere ? m.moveHere : ""}
                              </option>
                            );
                          })}
                        </select>
                        {current ? (
                          config.slotBody(slot, current, slotCtx)
                        ) : (
                          <small className="muted">
                            {config.emptySlotHint(slot, options.length)}
                          </small>
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
                  <p className="muted small">{config.contribEmptyMsg}</p>
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
                      <span className="muted">{config.previewNoLabel}</span>
                      <div className="result-sub">
                        {formatDamage(preview.without.finalDamage)}
                      </div>
                    </div>
                    <div>
                      <span className="muted">{config.previewGainLabel}</span>
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
                  <p className="muted small">{m.previewNeedProfile}</p>
                )}

                {config.shouldShowGainPanel(
                  activeProfile,
                  comparison,
                  activeScheme,
                ) ? (
                  <GainPanel
                    comparison={comparison!}
                    piecesById={config.piecesById}
                    gainMode={gainMode}
                    setGainMode={setGainMode}
                    hasScheme={!!activeScheme}
                    gainTitle={config.gainTitle}
                    gainHintWith={config.gainHintWith}
                    gainHintEmpty={config.gainHintEmpty}
                    equippedHeader={config.equippedHeader}
                    emptyHint={config.emptyHint}
                    gainRowMeta={config.gainRowMeta}
                    libraryGain={config.libraryGain}
                  />
                ) : (
                  <>{config.gainFallback?.(activeProfile, activeScheme)}</>
                )}
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function LibraryGainNote<S extends string>({
  inUse,
  swap,
  equippedGain,
}: {
  inUse: boolean;
  swap?: LoadoutSwapGain<S>;
  equippedGain?: LoadoutSlotGain<unknown, S>;
}): React.JSX.Element | null {
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
      {action} {formatSignedDamage(swap.delta)}（
      {formatSignedRatio(swap.ratio)}）
    </p>
  );
}

function GainPanel<
  P extends { id: string },
  S extends string,
  Comp extends {
    equipped: LoadoutSlotGain<P, S>[];
    byPieceId: Map<string, LoadoutSwapGain<S>>;
  },
>({
  comparison,
  piecesById,
  gainMode,
  setGainMode,
  hasScheme,
  gainTitle,
  gainHintWith,
  gainHintEmpty,
  equippedHeader,
  emptyHint,
  gainRowMeta,
  libraryGain,
  libraryTitle,
}: {
  comparison: Comp;
  piecesById: Map<string, P>;
  gainMode: "marginal" | "solo";
  setGainMode: (mode: "marginal" | "solo") => void;
  hasScheme: boolean;
  gainTitle: string;
  gainHintWith: string;
  gainHintEmpty: string;
  equippedHeader?: string;
  emptyHint?: string;
  libraryTitle?: string;
  gainRowMeta: (
    row: LoadoutSlotGain<P, S>,
  ) => { pillClass: string; pillLabel: string; name: string };
  libraryGain?: {
    rowMeta: (
      pieceId: string,
      piecesById: Map<string, P>,
    ) => { pillClass: string; pillLabel: string; name: string };
  };
}): React.JSX.Element {
  const { m } = useI18n();
  const equippedRows = [...comparison.equipped].sort((a, b) => {
    const va = gainMode === "solo" ? a.soloDelta : a.delta;
    const vb = gainMode === "solo" ? b.soloDelta : b.delta;
    return vb - va;
  });
  const equippedMax = Math.max(
    0,
    ...equippedRows.map((r) =>
      Math.abs(gainMode === "solo" ? r.soloDelta : r.delta),
    ),
  );

  const libraryRows = libraryGain
    ? [...comparison.byPieceId.values()].sort(
        (a, b) => b.delta - a.delta || b.newDamage - a.newDamage,
      )
    : [];
  const libraryMax = Math.max(
    0,
    ...libraryRows.map((r) => Math.abs(r.delta)),
  );

  return (
    <div className="circuit-gain-panel">
      <h3 className="section-title">{gainTitle}</h3>
      <p className="muted small">{hasScheme ? gainHintWith : gainHintEmpty}</p>

      {equippedRows.length > 0 ? (
        <>
          {equippedHeader ? (
            <h3 className="section-title">{equippedHeader}</h3>
          ) : null}
          <div
            className="circuit-gain-modes"
            role="group"
            aria-label={m.gainAlgoAria}
          >
            <button
              type="button"
              className={gainMode === "marginal" ? "tab active" : "tab"}
              onClick={() => setGainMode("marginal")}
            >
              {m.marginal}
            </button>
            <button
              type="button"
              className={gainMode === "solo" ? "tab active" : "tab"}
              onClick={() => setGainMode("solo")}
            >
              {m.solo}
            </button>
          </div>
          <div className="circuit-gain-list">
            {equippedRows.map((row) => {
              const meta = gainRowMeta(row);
              const value = gainMode === "solo" ? row.soloDelta : row.delta;
              const ratio = gainMode === "solo" ? row.soloRatio : row.ratio;
              const width =
                equippedMax > 0 ? (Math.abs(value) / equippedMax) * 100 : 0;
              return (
                <div
                  key={`${row.slot}-${row.piece.id}`}
                  className="circuit-gain-row"
                >
                  <div className="circuit-gain-meta">
                    <span className="circuit-gain-slot">
                      {slotLabel(row.slot)}
                    </span>
                    <span className={`kind-pill ${meta.pillClass}`}>
                      {meta.pillLabel}
                    </span>
                    <span className="circuit-gain-name">{meta.name}</span>
                  </div>
                  <div className="circuit-gain-bar-track">
                    <div
                      className={`circuit-gain-bar kind-${meta.pillClass} ${
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
        </>
      ) : emptyHint ? (
        <p className="muted small">{emptyHint}</p>
      ) : null}

      {libraryGain && libraryRows.length > 0 ? (
        <>
          <h3 className="section-title">
            {libraryTitle ?? m.allInsignias}{" "}
            <span className="muted small">({libraryRows.length})</span>
          </h3>
          <p className="muted small">{m.libraryGainHint}</p>
          <div className="circuit-gain-list">
            {libraryRows.map((row) => {
              const piece = piecesById.get(row.pieceId);
              if (!piece) return null;
              const meta = libraryGain.rowMeta(row.pieceId, piecesById);
              const width =
                libraryMax > 0 ? (Math.abs(row.delta) / libraryMax) * 100 : 0;
              const action =
                row.action === "add"
                  ? m.addToSlot(slotLabel(row.slot))
                  : row.action === "swap"
                    ? m.swapToSlot(slotLabel(row.slot))
                    : m.keepSlot(slotLabel(row.slot));
              return (
                <div key={row.pieceId} className="circuit-gain-row">
                  <div className="circuit-gain-meta">
                    <span className={`kind-pill ${meta.pillClass}`}>
                      {meta.pillLabel}
                    </span>
                    <span className="circuit-gain-name">{meta.name}</span>
                    <span className="muted small">{action}</span>
                  </div>
                  <div className="circuit-gain-bar-track">
                    <div
                      className={`circuit-gain-bar kind-${meta.pillClass} ${
                        row.delta < 0 ? "neg" : ""
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className={`circuit-gain-nums ${gainClass(row.delta)}`}>
                    <span>{formatSignedDamage(row.delta)}</span>
                    <span>{formatSignedRatio(row.ratio)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
