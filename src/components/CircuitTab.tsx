import { useMemo, useState } from "react";
import type {
  CircuitKind,
  CircuitPiece,
  CircuitScheme,
  CircuitSlotId,
  CircuitStatKey,
} from "../lib/types";
import { formatSignedRatio, gainClass } from "../lib/format";
import { parseStatInput, statInputValue } from "../lib/statInput";
import {
  CIRCUIT_BREAK_STATS,
  CIRCUIT_KIND_LABEL,
  CIRCUIT_MAIN_STATS,
  CIRCUIT_PERCENT_STATS,
  CIRCUIT_SLOT_DEFS,
  CIRCUIT_SLOT_KIND,
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
} from "../lib/circuit";
import { CircuitScanPanel } from "./CircuitScanPanel";
import { type LoadoutSlotGain, type LoadoutSwapGain } from "../lib/loadout";
import { type AffixDraft } from "./forms";
import { type LoadoutConfig, LoadoutTab } from "./LoadoutTab";
import {
  inferKindFromMain,
  type CircuitParseResult,
} from "../lib/circuitParse";
import { encodeCircuitSchemeCode } from "../lib/schemeShare";
import { circuitKindLabel, circuitStatLabel } from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

type SubDraft = AffixDraft<string>;

const KIND_OPTIONS: CircuitKind[] = ["time", "nether", "star", "key"];

type CircuitDraft = {
  name: string;
  kind: CircuitKind;
  mainStat: CircuitStatKey;
  mainValue: number;
  subs: SubDraft[];
  breakthroughs: SubDraft[];
};

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
        if (used.has(s.stat as CircuitStatKey)) return false;
        used.add(s.stat as CircuitStatKey);
      }
      return Number.isFinite(s.value);
    })
    .slice(0, 4)
    .map((r) => ({ stat: r.stat as CircuitStatKey, value: r.value }));
}

export function CircuitTab() {
  const { m } = useI18n();
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

  const circuitsById = useMemo(() => {
    const map = new Map<string, CircuitPiece>();
    for (const c of circuits) map.set(c.id, c);
    return map;
  }, [circuits]);

  const [kindFilter, setKindFilter] = useState<CircuitKind | "all">("all");

  function changeKind(
    _draft: CircuitDraft,
    setDraft: React.Dispatch<React.SetStateAction<CircuitDraft>>,
    next: CircuitKind,
  ): void {
    setDraft((d) => {
      const nd = { ...d, kind: next };
      if (!isValidMainStat(next, d.mainStat)) {
        nd.mainStat = defaultMainStat(next);
        nd.mainValue = 0;
      }
      return nd;
    });
  }

  function applyScanToForm(
    result: CircuitParseResult,
    draft: CircuitDraft,
    setDraft: React.Dispatch<React.SetStateAction<CircuitDraft>>,
  ): void {
    const nextKind = result.kind ?? draft.kind;
    if (result.kind && result.kind !== draft.kind) {
      changeKind(draft, setDraft, result.kind);
    }
    if (result.main) {
      if (isValidMainStat(nextKind, result.main.stat)) {
        setDraft((d) => ({
          ...d,
          mainStat: result.main!.stat,
          mainValue: result.main!.value,
        }));
      } else {
        const inferred = inferKindFromMain(result.main.stat);
        if (inferred) {
          changeKind(draft, setDraft, inferred);
          setDraft((d) => ({
            ...d,
            mainStat: result.main!.stat,
            mainValue: result.main!.value,
          }));
        }
      }
    }
    setDraft((d) => ({
      ...d,
      subs: fillAffixRows(result.subs),
      breakthroughs: fillAffixRows(result.breakthroughs),
      name: result.name || d.name,
    }));
    onStatus(m.filledForm);
  }

  function addFromScan(
    result: CircuitParseResult,
    setDraft: React.Dispatch<React.SetStateAction<CircuitDraft>>,
  ): void {
    const nextKind =
      result.kind ??
      (result.main ? inferKindFromMain(result.main.stat) : null) ??
      "time";
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
    setDraft({
      name: "",
      kind: "time",
      mainStat: "critRate",
      mainValue: 0,
      subs: emptyAffixRows(),
      breakthroughs: emptyAffixRows(),
    });
  }

  const config: LoadoutConfig<
    CircuitPiece,
    CircuitScheme,
    CircuitSlotId,
    CircuitKind,
    CircuitDraft,
    ReturnType<typeof schemeContribution>["extra"],
    ReturnType<typeof compareSchemeCircuits>
  > = {
    formTitle: (editing) => (editing ? m.editCircuit : m.addCircuit),
    formHint: m.circuitFormHint,
    addLabel: m.addCircuit,
    namePlaceholder: m.autoNamePh,
    libTitle: m.circuitLib,
    noLibMsg: m.noCircuits,
    searchPlaceholder: m.searchCircuits,
    schemesTitle: m.circuitSchemes,
    schemesHint: m.circuitSchemeHint,
    noSchemesMsg: m.noSchemes,
    schemes: schemes,
    pieces: circuits,
    piecesById: circuitsById,
    contribEmptyMsg: m.noCircuitDamage,
    schemeShareKind: "circuit",
    gainTitle: m.circuitGainTitle,
    gainHintWith: m.circuitGainHint,
    gainHintEmpty: m.circuitGainHint,
    equippedHeader: undefined,
    emptyHint: undefined,
    previewNoLabel: m.previewNoCircuit,
    previewGainLabel: m.previewCircuitGain,

    blankDraft: () => ({
      name: "",
      kind: "time",
      mainStat: "critRate",
      mainValue: 0,
      subs: emptyAffixRows(),
      breakthroughs: emptyAffixRows(),
    }),
    loadDraft: (piece) => ({
      name: piece.name,
      kind: piece.kind,
      mainStat: piece.main.stat,
      mainValue: piece.main.value,
      subs: fillAffixRows(piece.subs),
      breakthroughs: fillAffixRows(piece.breakthroughs),
    }),
    onSave: (draft, editingId) => {
      const draft2: CircuitPiece = {
        id: editingId ?? blankCircuitPiece(draft.kind).id,
        name: draft.name.trim(),
        kind: draft.kind,
        main: { stat: draft.mainStat, value: draft.mainValue },
        subs: cleanAffixRows(draft.subs),
        breakthroughs: cleanAffixRows(draft.breakthroughs, {
          allowDuplicates: true,
        }),
        createdAt:
          circuits.find((c) => c.id === editingId)?.createdAt ??
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!draft2.name) draft2.name = defaultCircuitName(draft2);
      setCircuits((list) => {
        const idx = list.findIndex((c) => c.id === draft2.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = draft2;
          return next;
        }
        return [draft2, ...list];
      });
      onStatus(
        editingId ? m.updatedCircuit(draft2.name) : m.addedCircuit(draft2.name),
      );
    },
    getName: (d) => d.name,
    setName: (d, name) => ({ ...d, name }),
    deletePiece: (id) => {
      const piece = circuitsById.get(id);
      setCircuits((list) => list.filter((c) => c.id !== id));
      setSchemes((list) => detachCircuitsFromSchemes(list, [id]));
      onStatus(m.deletedCircuit(piece?.name || id));
    },
    exportActiveScheme: (scheme) =>
      encodeCircuitSchemeCode(scheme, circuitsById),
    onImportShareCode,
    renderScan: (draft, setDraft) => (
      <CircuitScanPanel
        kindHint={draft.kind}
        onApplyToForm={(result) => applyScanToForm(result, draft, setDraft)}
        onAddDirectly={(result) => addFromScan(result, setDraft)}
        onStatus={onStatus}
      />
    ),
    renderFields: (draft, setDraft) => (
      <>
        <label>
          {m.circuitKind}
          <select
            value={draft.kind}
            onChange={(e) =>
              changeKind(
                draft,
                setDraft,
                e.target.value as CircuitKind,
              )
            }
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
            value={draft.mainStat}
            onChange={(e) => {
              const next = e.target.value as CircuitStatKey;
              setDraft((d) => ({
                ...d,
                mainStat: next,
                mainValue: 0,
              }));
            }}
          >
            {CIRCUIT_MAIN_STATS[draft.kind].map((s) => (
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
          {CIRCUIT_PERCENT_STATS.has(draft.mainStat) ? " (%)" : ""}
          <div
            className={
              CIRCUIT_PERCENT_STATS.has(draft.mainStat)
                ? "input-with-suffix"
                : undefined
            }
          >
            <input
              type="number"
              step={CIRCUIT_PERCENT_STATS.has(draft.mainStat) ? "0.1" : "1"}
              value={statInputValue(
                draft.mainStat,
                draft.mainValue,
                CIRCUIT_PERCENT_STATS,
              )}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  mainValue: parseStatInput(
                    d.mainStat,
                    e.target.value,
                    CIRCUIT_PERCENT_STATS,
                  ),
                }))
              }
            />
            {CIRCUIT_PERCENT_STATS.has(draft.mainStat) ? (
              <span className="input-suffix">%</span>
            ) : null}
          </div>
        </label>
      </>
    ),
    affixBlocks: [
      {
        title: m.subStatsTitle,
        rowLabel: m.subStat,
        options: CIRCUIT_SUB_STATS,
        percentSet: CIRCUIT_PERCENT_STATS,
        labelFor: (s) => circuitStatLabel(s as CircuitStatKey),
        suffixFor: (s) => (s === "elementalPower" ? m.elemPoints : ""),
        getRows: (d) => d.subs,
        setRows: (d, rows) => ({ ...d, subs: rows }),
      },
      {
        title: m.breakStatsTitle,
        hint: m.breakStatsHint,
        rowLabel: m.breakLabel,
        options: CIRCUIT_BREAK_STATS,
        percentSet: CIRCUIT_PERCENT_STATS,
        labelFor: (s) => circuitStatLabel(s as CircuitStatKey),
        suffixFor: (s) => (s === "elementalPower" ? m.elemPoints : ""),
        allowDuplicates: true,
        getRows: (d) => d.breakthroughs,
        setRows: (d, rows) => ({ ...d, breakthroughs: rows }),
      },
    ],

    pieceStatLines: (piece) => pieceStatLines(piece),
    cardPills: (piece) => (
      <span className={`kind-pill ${piece.kind}`}>
        {circuitKindLabel(piece.kind)}
      </span>
    ),
    cardCanSocket: (piece) => m.canSocket(slotHint(piece.kind)),
    renderFilterSelects: () => (
      <>
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
      </>
    ),
    applyFilters: (pieces, ctx) => {
      const q = ctx.search.trim().toLowerCase();
      const list = pieces.filter((c) => {
        if (kindFilter !== "all" && c.kind !== kindFilter) return false;
        if (!q) return true;
        const label = (c.name || defaultCircuitName(c)).toLowerCase();
        const hay = [
          label,
          CIRCUIT_KIND_LABEL[c.kind],
          circuitKindLabel(c.kind),
          CIRCUIT_STAT_LABEL[c.main.stat],
          circuitStatLabel(c.main.stat),
          ...c.subs.flatMap((s) => [
            CIRCUIT_STAT_LABEL[s.stat],
            circuitStatLabel(s.stat),
          ]),
          ...(c.breakthroughs ?? []).flatMap((s) => [
            CIRCUIT_STAT_LABEL[s.stat],
            circuitStatLabel(s.stat),
          ]),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
      if (ctx.libSort !== "gain" || !ctx.comparison) return list;
      const comp = ctx.comparison;
      const equippedGainById = new Map(
        comp.equipped.map((r) => [r.piece.id, r]),
      );
      return [...list].sort((a, b) => {
        const ga = librarySortValue(a.id, equippedGainById, comp.byPieceId);
        const gb = librarySortValue(b.id, equippedGainById, comp.byPieceId);
        return gb - ga;
      });
    },

    schemeOptionLabel: (scheme) =>
      m.schemeCount(scheme.name, equippedCount(scheme)),
    isApplied: (profile, schemeId) =>
      !!profile && profile.circuitSchemeId === schemeId,
    getProfileSchemeId: (profile) => profile?.circuitSchemeId ?? null,
    applyToProfile: (schemeId) => {
      if (!activeProfile) {
        onStatus(m.pickProfileFirst);
        return;
      }
      updateProfile(activeProfile.id, { circuitSchemeId: schemeId });
    },
    addScheme: () => {
      const scheme = blankCircuitScheme(
        m.defaultSchemeName(schemes.length + 1),
      );
      setSchemes((list) => [scheme, ...list]);
      onStatus(m.addedCircuitScheme);
      return scheme.id;
    },
    duplicateScheme: (scheme) => {
      const copy: CircuitScheme = {
        ...structuredClone(scheme),
        id: blankCircuitScheme().id,
        name: `${scheme.name}${m.copiedSuffix}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSchemes((list) => [copy, ...list]);
      onStatus(m.copiedCircuitScheme);
      return copy.id;
    },
    deleteScheme: (id) => {
      setSchemes((list) => list.filter((s) => s.id !== id));
      onStatus(m.deletedCircuitScheme);
    },
    patchScheme: (id, patch) => {
      setSchemes((list) =>
        list.map((s) =>
          s.id === id
            ? { ...s, ...patch, updatedAt: new Date().toISOString() }
            : s,
        ),
      );
    },
    equippedCount,
    schemeContribution: (scheme, piecesById, element) =>
      schemeContribution(scheme, piecesById, element),
    contributionLines: (contrib) => contributionLines(contrib),
    computeComparison: (scheme, profile) => {
      if (!scheme || !profile) return null;
      return compareSchemeCircuits(
        scheme,
        circuits,
        circuitsById,
        (s) => profileResult(profile, s).finalDamage,
      );
    },
    computePreview: (scheme, profile) => ({
      withScheme: profileResult(profile, scheme),
      without: profileResult(profile, null),
    }),
    shouldShowGainPanel: (profile, comparison, _activeScheme) =>
      !!profile && !!comparison && comparison.equipped.length > 0,
    gainFallback: (profile, activeScheme) =>
      !profile && activeScheme ? (
        <p className="muted small">{m.pickProfileToCompare}</p>
      ) : activeScheme && equippedCount(activeScheme) === 0 ? (
        <p className="muted small">{m.socketToCompare}</p>
      ) : null,

    slotDefs: CIRCUIT_SLOT_DEFS.map((s) => ({ id: s.id, kind: s.kind })),
    slotFilledClass: (current) => (current ? "filled" : ""),
    slotPill: (slot) => (
      <span className={`kind-pill ${CIRCUIT_SLOT_KIND[slot]}`}>
        {circuitKindLabel(CIRCUIT_SLOT_KIND[slot])}
      </span>
    ),
    slotOptions: (slot, _currentId, _ctx) => {
      const kind = CIRCUIT_SLOT_KIND[slot];
      return circuits
        .filter((c) => c.kind === kind)
        .map((c) => ({
          id: c.id,
          label: c.name || defaultCircuitName(c),
          gainText: "",
        }));
    },
    slotBody: (_slot, current, ctx) => {
      const gain = ctx.equippedGainById.get(current.id);
      return (
        <small className="circuit-slot-main">
          {formatAffix(current.main)}
          {current.subs.length ? m.subCount(current.subs.length) : ""}
          {(current.breakthroughs ?? []).length
            ? m.breakCount((current.breakthroughs ?? []).length)
            : ""}
          {gain ? (
            <>
              {" · "}
              <span className={gainClass(gain.delta)}>
                {formatSignedRatio(gain.ratio)}
              </span>
            </>
          ) : null}
        </small>
      );
    },
    emptySlotHint: (slot) => m.canFit(slotHint(CIRCUIT_SLOT_KIND[slot])),
    equipSlot: (schemeId, slot, id) => {
      setSchemes((list) =>
        list.map((s) =>
          s.id === schemeId ? assignCircuitToSlot(s, slot, id) : s,
        ),
      );
    },

    gainRowMeta: (row) => ({
      pillClass: row.piece.kind,
      pillLabel: circuitKindLabel(row.piece.kind),
      name: row.piece.name || defaultCircuitName(row.piece),
    }),
  };

  return <LoadoutTab config={config} />;
}

function librarySortValue(
  pieceId: string,
  equipped: Map<string, LoadoutSlotGain<CircuitPiece, CircuitSlotId>>,
  swaps: Map<string, LoadoutSwapGain<CircuitSlotId>>,
): number {
  const row = equipped.get(pieceId);
  if (row) return row.delta;
  return swaps.get(pieceId)?.delta ?? Number.NEGATIVE_INFINITY;
}
