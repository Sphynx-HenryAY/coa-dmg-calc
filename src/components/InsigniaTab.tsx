import { useEffect, useMemo, useState } from "react";
import type {
  CircuitElement,
  InsigniaPiece,
  InsigniaRank,
  InsigniaRarity,
  InsigniaScheme,
  InsigniaSlotId,
  InsigniaStatKey,
} from "../lib/types";
import { formatDamage, formatRatio } from "../lib/damage";
import { formatSignedDamage, formatSignedRatio, gainClass } from "../lib/format";
import {
  INSIGNIA_PERCENT_STATS,
  INSIGNIA_RANKS,
  INSIGNIA_RARITY_LABEL,
  INSIGNIA_SLOT_GROUPS,
  INSIGNIA_SLOT_IDS,
  INSIGNIA_STAT_LABEL,
  INSIGNIA_STAT_OPTIONS,
  assignInsigniaToSlot,
  blankInsigniaPiece,
  blankInsigniaScheme,
  canSocketIn,
  compareSchemeInsignias,
  contributionLines,
  defaultInsigniaName,
  detachInsigniasFromSchemes,
  equippedCount,
  formatInsigniaAffix,
  pieceStatLines,
  schemeContribution,
  slotHint,
  type InsigniaSlotGain,
  type InsigniaSwapGain,
} from "../lib/insignia";
import { SchemeShareBox } from "./SchemeShareBox";
import { AffixRowList } from "./forms";
import { encodeInsigniaSchemeCode } from "../lib/schemeShare";
import {
  insigniaRarityLabel,
  insigniaStatLabel,
  m as i18nMsg,
  slotLabel,
} from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

type AffixDraft = { stat: InsigniaStatKey | ""; value: number };

const RARITY_OPTIONS: InsigniaRarity[] = ["epic", "rare"];
const AFFIX_ROW_COUNT = 6;

function emptyAffixRows(): AffixDraft[] {
  return Array.from({ length: AFFIX_ROW_COUNT }, () => ({
    stat: "",
    value: 0,
  }));
}

function fillAffixRows(list: InsigniaPiece["affixes"] | undefined): AffixDraft[] {
  const next = emptyAffixRows();
  (list ?? []).slice(0, AFFIX_ROW_COUNT).forEach((affix, i) => {
    next[i] = { stat: affix.stat, value: affix.value };
  });
  return next;
}

function cleanAffixRows(
  rows: AffixDraft[],
): Array<{ stat: InsigniaStatKey; value: number }> {
  return rows
    .filter((s): s is { stat: InsigniaStatKey; value: number } => {
      if (!s.stat) return false;
      return Number.isFinite(s.value);
    })
    .slice(0, AFFIX_ROW_COUNT);
}

export function InsigniaTab() {
  const { locale, m } = useI18n();
  const {
    insignias,
    insigniaSchemes: schemes,
    setInsignias,
    setInsigniaSchemes: setSchemes,
    activeProfile,
    setStatus: onStatus,
    importInsigniaSchemeFromCode: onImportShareCode,
    profileResult,
    updateProfile,
  } = useAppStore();

  const onApplyScheme = (schemeId: string | null) => {
    if (!activeProfile) {
      onStatus(m.pickProfileFirst);
      return;
    }
    updateProfile(activeProfile.id, { insigniaSchemeId: schemeId });
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rarity, setRarity] = useState<InsigniaRarity>("epic");
  const [slots, setSlots] = useState<InsigniaSlotId[]>([]);
  const [rank, setRank] = useState<InsigniaRank>(3);
  const [note, setNote] = useState("");
  const [affixes, setAffixes] = useState<AffixDraft[]>(emptyAffixRows);
  const [rarityFilter, setRarityFilter] = useState<InsigniaRarity | "all">(
    "all",
  );
  const [slotFilter, setSlotFilter] = useState<InsigniaSlotId | "all">("all");
  const [search, setSearch] = useState("");
  const [libSort, setLibSort] = useState<"default" | "gain">("default");
  const [gainMode, setGainMode] = useState<"marginal" | "solo">("marginal");
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(
    schemes[0]?.id ?? null,
  );

  const insigniasById = useMemo(() => {
    const map = new Map<string, InsigniaPiece>();
    for (const p of insignias) map.set(p.id, p);
    return map;
  }, [insignias]);

  useEffect(() => {
    if (activeSchemeId && schemes.some((s) => s.id === activeSchemeId)) return;
    setActiveSchemeId(schemes[0]?.id ?? null);
  }, [schemes, activeSchemeId]);

  useEffect(() => {
    const id = activeProfile?.insigniaSchemeId;
    if (id && schemes.some((s) => s.id === id)) setActiveSchemeId(id);
    // Only follow the profile when the selected profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  const activeScheme = schemes.find((s) => s.id === activeSchemeId) ?? null;
  const element: CircuitElement | "all" = activeProfile?.element ?? "all";

  const contrib = useMemo(() => {
    if (!activeScheme) return null;
    return schemeContribution(activeScheme, insigniasById, element);
  }, [activeScheme, insigniasById, element]);

  const contribText = contrib ? contributionLines(contrib) : null;

  const preview = useMemo(() => {
    if (!activeProfile) return null;
    const withScheme = profileResult(activeProfile, undefined, activeScheme);
    const without = profileResult(activeProfile, undefined, null);
    return { withScheme, without };
  }, [activeProfile, activeScheme, profileResult]);

  const comparison = useMemo(() => {
    if (!activeProfile || insignias.length === 0) return null;
    const scheme = activeScheme ?? blankInsigniaScheme(m.emptySchemeName);
    return compareSchemeInsignias(
      scheme,
      insignias,
      insigniasById,
      (next) => profileResult(activeProfile, undefined, next).finalDamage,
    );
  }, [activeProfile, activeScheme, insignias, insigniasById, profileResult]);

  const equippedGainById = useMemo(() => {
    const map = new Map<string, InsigniaSlotGain>();
    if (!comparison) return map;
    for (const row of comparison.equipped) map.set(row.piece.id, row);
    return map;
  }, [comparison]);

  const filteredInsignias = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = insignias.filter((p) => {
      if (rarityFilter !== "all" && p.rarity !== rarityFilter) return false;
      if (slotFilter !== "all" && !p.slots.includes(slotFilter)) return false;
      if (!q) return true;
      const label = (p.name || defaultInsigniaName(p)).toLowerCase();
      const hay = [
        label,
        INSIGNIA_RARITY_LABEL[p.rarity],
        insigniaRarityLabel(p.rarity),
        ...p.slots,
        ...p.slots.map((s) => slotLabel(s)),
        ...p.affixes.map((a) => INSIGNIA_STAT_LABEL[a.stat]),
        p.note,
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
    insignias,
    rarityFilter,
    slotFilter,
    search,
    libSort,
    comparison,
    equippedGainById,
    locale,
  ]);

  function resetForm(): void {
    setEditingId(null);
    setName("");
    setRarity("epic");
    setSlots([]);
    setRank(3);
    setNote("");
    setAffixes(emptyAffixRows());
  }

  function startEdit(piece: InsigniaPiece): void {
    setEditingId(piece.id);
    setName(piece.name);
    setRarity(piece.rarity);
    setSlots([...piece.slots]);
    setRank(piece.rank);
    setNote(piece.note);
    setAffixes(fillAffixRows(piece.affixes));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSlot(slot: InsigniaSlotId): void {
    setSlots((list) =>
      list.includes(slot) ? list.filter((s) => s !== slot) : [...list, slot],
    );
  }

  function savePiece(): void {
    const cleaned = cleanAffixRows(affixes);
    if (slots.length === 0) {
      onStatus(m.needOneSlot);
      return;
    }
    const draft: InsigniaPiece = {
      id: editingId ?? blankInsigniaPiece(rarity).id,
      name: name.trim(),
      rarity,
      slots: INSIGNIA_SLOT_IDS.filter((s) => slots.includes(s)),
      rank,
      affixes: cleaned,
      note: note.trim(),
      createdAt:
        insignias.find((p) => p.id === editingId)?.createdAt ??
        new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!draft.name) draft.name = defaultInsigniaName(draft);

    setInsignias((list) => {
      const idx = list.findIndex((p) => p.id === draft.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = draft;
        return next;
      }
      return [draft, ...list];
    });
    onStatus(
      editingId ? m.updatedInsignia(draft.name) : m.addedInsignia(draft.name),
    );
    resetForm();
  }

  function duplicatePiece(piece: InsigniaPiece): void {
    const copy: InsigniaPiece = {
      ...structuredClone(piece),
      id: blankInsigniaPiece(piece.rarity).id,
      name: `${piece.name || defaultInsigniaName(piece)}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setInsignias((list) => [copy, ...list]);
    onStatus(m.copiedInsignia(copy.name));
  }

  function deletePiece(id: string): void {
    const piece = insigniasById.get(id);
    setInsignias((list) => list.filter((p) => p.id !== id));
    setSchemes((list) => detachInsigniasFromSchemes(list, [id]));
    if (editingId === id) resetForm();
    onStatus(m.deletedInsignia(piece?.name || id));
  }

  function addScheme(): void {
    const scheme = blankInsigniaScheme(m.defaultSchemeName(schemes.length + 1));
    setSchemes((list) => [scheme, ...list]);
    setActiveSchemeId(scheme.id);
    onStatus(m.addedInsigniaScheme);
  }

  function duplicateScheme(scheme: InsigniaScheme): void {
    const copy: InsigniaScheme = {
      ...structuredClone(scheme),
      id: blankInsigniaScheme().id,
      name: `${scheme.name}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchemes((list) => [copy, ...list]);
    setActiveSchemeId(copy.id);
    onStatus(m.copiedInsigniaScheme);
  }

  function deleteScheme(id: string): void {
    setSchemes((list) => list.filter((s) => s.id !== id));
    if (activeSchemeId === id) {
      setActiveSchemeId(schemes.find((s) => s.id !== id)?.id ?? null);
    }
    onStatus(m.deletedInsigniaScheme);
  }

  function patchScheme(id: string, patch: Partial<InsigniaScheme>): void {
    setSchemes((list) =>
      list.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  }

  function equipSlot(slot: InsigniaSlotId, insigniaId: string | null): void {
    if (!activeScheme) return;
    setSchemes((list) =>
      list.map((s) =>
        s.id === activeScheme.id
          ? assignInsigniaToSlot(s, slot, insigniaId)
          : s,
      ),
    );
  }

  async function exportActiveScheme(): Promise<string> {
    if (!activeScheme) throw new Error(m.pickSchemeToExport);
    return encodeInsigniaSchemeCode(activeScheme, insigniasById);
  }

  const usedInScheme = new Set(
    activeScheme
      ? Object.values(activeScheme.equipped).filter((x): x is string => !!x)
      : [],
  );

  const applied =
    !!activeProfile &&
    !!activeScheme &&
    activeProfile.insigniaSchemeId === activeScheme.id;

  return (
    <div className="layout-2">
      <section className="panel">
        <h2>{editingId ? m.editInsignia : m.addInsignia}</h2>
        <p className="muted small">
          {m.insigniaFormHint}
        </p>

        <div className="form-grid">
          <label>
            {m.name}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={m.autoNameInsigniaPh}
            />
          </label>
          <label>
            {m.rarity}
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value as InsigniaRarity)}
            >
              {RARITY_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {insigniaRarityLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.rank}
            <select
              value={rank}
              onChange={(e) => setRank(Number(e.target.value) as InsigniaRank)}
            >
              {INSIGNIA_RANKS.map((r) => (
                <option key={r} value={r}>
                  {m.rankN(r)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.note}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={m.insigniaNotePh}
            />
          </label>
        </div>

        <h3 className="section-title">{m.socketSlots}</h3>
        <p className="muted small">
          {m.socketSlotsHint}
        </p>
        <div className="slot-chip-groups">
          {INSIGNIA_SLOT_GROUPS.map((group) => (
            <div key={group.group} className="slot-chip-group">
              <span className="muted small">{slotLabel(group.group)}</span>
              <div className="slot-chip-grid">
                {group.slots.map((slot) => {
                  const on = slots.includes(slot);
                  return (
                    <label
                      key={slot}
                      className={`slot-chip ${on ? "on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleSlot(slot)}
                      />
                      {slotLabel(slot)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <h3 className="section-title">{m.effectsMax6}</h3>
        <p className="muted small">
          {m.effectsHint}
        </p>
        <AffixRowList
          rows={affixes}
          options={INSIGNIA_STAT_OPTIONS}
          percentSet={INSIGNIA_PERCENT_STATS}
          labelFor={insigniaStatLabel}
          suffixFor={(s) =>
            s === "elementalPower" ||
            s === "ice" ||
            s === "fire" ||
            s === "electric" ||
            s === "dark"
              ? m.elemPoints
              : ""
          }
          rowHeader={(i) => m.effectN(i + 1)}
          onChange={setAffixes}
        />

        <div className="form-actions">
          <button type="button" onClick={savePiece}>
            {editingId ? m.saveChanges : m.addInsignia}
          </button>
          {editingId ? (
            <button type="button" className="secondary" onClick={resetForm}>
              {m.cancelEdit}
            </button>
          ) : null}
        </div>

        <h3 className="section-title">
          {m.insigniaLib}{" "}
          <span className="muted small">
            ({filteredInsignias.length} / {insignias.length})
          </span>
        </h3>
        <div className="filter-row">
          <input
            placeholder={m.searchInsignias}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={rarityFilter}
            onChange={(e) =>
              setRarityFilter(e.target.value as InsigniaRarity | "all")
            }
          >
            <option value="all">{m.allRarities}</option>
            {RARITY_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {insigniaRarityLabel(r)}
              </option>
            ))}
          </select>
          <select
            value={slotFilter}
            onChange={(e) =>
              setSlotFilter(e.target.value as InsigniaSlotId | "all")
            }
          >
            <option value="all">{m.allSlots}</option>
            {INSIGNIA_SLOT_IDS.map((s) => (
              <option key={s} value={s}>
                {slotLabel(s)}
              </option>
            ))}
          </select>
          <select
            value={libSort}
            onChange={(e) => setLibSort(e.target.value as "default" | "gain")}
          >
            <option value="default">{m.sortDefault}</option>
            <option value="gain">{m.sortGain}</option>
          </select>
        </div>
        <div className="gear-list">
          {filteredInsignias.length === 0 ? (
            <p className="muted">{m.noInsignias}</p>
          ) : (
            filteredInsignias.map((piece) => {
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
                        <span className={`kind-pill ${piece.rarity}`}>
                          {insigniaRarityLabel(piece.rarity)}
                        </span>{" "}
                        <span className="kind-pill rank">{m.rankN(piece.rank)}</span>{" "}
                        {piece.name || defaultInsigniaName(piece)}
                      </h3>
                      <p className="muted small">
                        {m.canSocket(slotHint(piece.slots))}
                        {inUse ? m.inUseScheme : ""}
                      </p>
                      {piece.note ? (
                        <p className="muted small">{piece.note}</p>
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
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => duplicatePiece(piece)}
                      >
                        {m.copy}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              m.confirmDeleteNamed(
                                piece.name || defaultInsigniaName(piece),
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
          <h2>{m.insigniaSchemes}</h2>
          <div className="panel-heading-actions">
            <button type="button" onClick={addScheme}>
              {m.addScheme}
            </button>
          </div>
        </div>
        <p className="muted small">
          {m.insigniaSchemeHint}
        </p>

        <SchemeShareBox
          kind="insignia"
          canExport={!!activeScheme}
          exportDisabledReason={m.exportNeedScheme}
          onExport={exportActiveScheme}
          onImport={onImportShareCode}
          onStatus={onStatus}
        />

        {schemes.length === 0 ? (
          <>
            <p className="muted">{m.noInsigniaSchemes}</p>
            {activeProfile && comparison ? (
              <InsigniaGainPanel
                comparison={comparison}
                insigniasById={insigniasById}
                gainMode={gainMode}
                onGainMode={setGainMode}
                hasScheme={false}
              />
            ) : !activeProfile ? (
              <p className="muted small">
                {m.soloBeforeScheme}
              </p>
            ) : null}
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
                  {INSIGNIA_SLOT_IDS.map((slot) => {
                    const currentId = activeScheme.equipped[slot] ?? "";
                    const current = currentId
                      ? insigniasById.get(currentId)
                      : undefined;
                    const slotGains = comparison?.bySlot.get(slot);
                    const gainByPieceId = new Map(
                      (slotGains ?? []).map((g) => [g.pieceId, g]),
                    );
                    const options = insignias
                      .filter((p) => canSocketIn(p, slot) || p.id === currentId)
                      .sort((a, b) => {
                        if (a.id === currentId) return -1;
                        if (b.id === currentId) return 1;
                        const ga = gainByPieceId.get(a.id)?.delta ?? Number.NEGATIVE_INFINITY;
                        const gb = gainByPieceId.get(b.id)?.delta ?? Number.NEGATIVE_INFINITY;
                        return gb - ga;
                      });
                    const slotMismatch = !!(
                      current && !canSocketIn(current, slot)
                    );
                    const slotGain = current
                      ? equippedGainById.get(current.id)
                      : undefined;
                    return (
                      <label
                        key={slot}
                        className={`circuit-slot ${
                          current ? `filled kind-${current.rarity}` : ""
                        }`}
                      >
                        <span className="circuit-slot-head">
                          <span className="circuit-slot-name">{slotLabel(slot)}</span>
                          {current ? (
                            <span className={`kind-pill ${current.rarity}`}>
                              {insigniaRarityLabel(current.rarity)}
                            </span>
                          ) : null}
                        </span>
                        <select
                          value={currentId}
                          onChange={(e) =>
                            equipSlot(slot, e.target.value || null)
                          }
                        >
                          <option value="">{m.unsocketed}</option>
                          {options.map((p) => {
                            const usedElsewhere =
                              usedInScheme.has(p.id) && p.id !== currentId;
                            const gain = gainByPieceId.get(p.id);
                            const gainText =
                              gain && p.id !== currentId
                                ? ` · ${formatSignedDamage(gain.delta)}`
                                : "";
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name || defaultInsigniaName(p)} · {m.rankShort(p.rank)}
                                {gainText}
                                {usedElsewhere ? m.moveHere : ""}
                              </option>
                            );
                          })}
                        </select>
                        {current ? (
                          <small className="circuit-slot-main">
                            {slotMismatch
                              ? m.cannotFitSlot
                              : current.affixes[0]
                                ? formatInsigniaAffix(current.affixes[0])
                                : m.noEffect}
                            {!slotMismatch && current.affixes.length > 1
                              ? m.moreEffects(current.affixes.length - 1)
                              : ""}
                            {!slotMismatch && slotGain ? (
                              <>
                                {" · "}
                                <span className={gainClass(slotGain.delta)}>
                                  {formatSignedDamage(slotGain.delta)}（
                                  {formatSignedRatio(slotGain.ratio)}）
                                </span>
                              </>
                            ) : null}
                          </small>
                        ) : (
                          <small className="muted">
                            {options.length
                              ? m.nCanFit(options.length)
                              : m.noneForSlot}
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
                  <p className="muted small">{m.noInsigniaDamage}</p>
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
                      <span className="muted">{m.previewNoInsignia}</span>
                      <div className="result-sub">
                        {formatDamage(preview.without.finalDamage)}
                      </div>
                    </div>
                    <div>
                      <span className="muted">{m.previewInsigniaGain}</span>
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

                {activeProfile && comparison ? (
                  <InsigniaGainPanel
                    comparison={comparison}
                    insigniasById={insigniasById}
                    gainMode={gainMode}
                    onGainMode={setGainMode}
                    hasScheme={!!activeScheme}
                  />
                ) : !activeProfile ? (
                  <p className="muted small">
                    {m.pickProfileInsigniaCompare}
                  </p>
                ) : insignias.length === 0 ? (
                  <p className="muted small">
                    {m.addInsigniaToCompare}
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
  equipped: Map<string, InsigniaSlotGain>,
  swaps: Map<string, InsigniaSwapGain>,
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
  swap?: InsigniaSwapGain;
  equippedGain?: InsigniaSlotGain;
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
      {action} {formatSignedDamage(swap.delta)}（{formatSignedRatio(swap.ratio)}
      ）
    </p>
  );
}

function swapActionLabel(swap: InsigniaSwapGain): string {
  const msg = i18nMsg();
  if (swap.action === "add") return msg.addToSlot(slotLabel(swap.slot));
  if (swap.action === "swap") return msg.swapToSlot(slotLabel(swap.slot));
  return msg.keepSlot(slotLabel(swap.slot));
}

function InsigniaGainPanel({
  comparison,
  insigniasById,
  gainMode,
  onGainMode,
  hasScheme,
}: {
  comparison: NonNullable<ReturnType<typeof compareSchemeInsignias>>;
  insigniasById: Map<string, InsigniaPiece>;
  gainMode: "marginal" | "solo";
  onGainMode: (mode: "marginal" | "solo") => void;
  hasScheme: boolean;
}) {
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

  const libraryRows = [...comparison.byPieceId.values()].sort(
    (a, b) => b.delta - a.delta || b.newDamage - a.newDamage,
  );
  const libraryMax = Math.max(
    0,
    ...libraryRows.map((r) => Math.abs(r.delta)),
  );

  return (
    <div className="circuit-gain-panel">
      <h3 className="section-title">{m.insigniaGainTitle}</h3>
      <p className="muted small">
        {hasScheme ? m.insigniaGainHintWith : m.insigniaGainHintEmpty}
      </p>

      {equippedRows.length > 0 ? (
        <>
          <h3 className="section-title">{m.equippedSection}</h3>
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
            {equippedRows.map((row) => {
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
      ) : (
        <p className="muted small">{m.notSocketedYet}</p>
      )}

      {libraryRows.length > 0 ? (
        <>
          <h3 className="section-title">
            {m.allInsignias}{" "}
            <span className="muted small">({libraryRows.length})</span>
          </h3>
          <p className="muted small">{m.libraryGainHint}</p>
          <div className="circuit-gain-list">
            {libraryRows.map((row) => {
              const piece = insigniasById.get(row.pieceId);
              if (!piece) return null;
              const width =
                libraryMax > 0 ? (Math.abs(row.delta) / libraryMax) * 100 : 0;
              return (
                <div key={row.pieceId} className="circuit-gain-row">
                  <div className="circuit-gain-meta">
                    <span className={`kind-pill ${piece.rarity}`}>
                      {insigniaRarityLabel(piece.rarity)}
                    </span>
                    <span className="circuit-gain-name">
                      {piece.name || defaultInsigniaName(piece)}
                    </span>
                    <span className="muted small">{swapActionLabel(row)}</span>
                  </div>
                  <div className="circuit-gain-bar-track">
                    <div
                      className={`circuit-gain-bar kind-${piece.rarity} ${
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


