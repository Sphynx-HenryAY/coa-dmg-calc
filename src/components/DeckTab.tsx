import { useMemo } from "react";
import type {
  DeckPiece,
  DeckScheme,
  DeckSlotId,
  InsigniaStatKey,
} from "../lib/types";
import { formatSignedDamage, formatSignedRatio, gainClass } from "../lib/format";
import {
  DECK_PERCENT_STATS,
  DECK_SLOT_IDS,
  DECK_STAT_OPTIONS,
  assignDeckToSlot,
  blankDeckPiece,
  blankDeckScheme,
  canSocketIn,
  compareSchemeDecks,
  contributionLines,
  deckStatLabel,
  defaultDeckName,
  detachDecksFromSchemes,
  equippedCount,
  formatDeckAffix,
  schemeContribution,
} from "../lib/deck";
import { type LoadoutSlotGain, type LoadoutSwapGain } from "../lib/loadout";
import { type AffixDraft } from "./forms";
import { type LoadoutConfig, LoadoutTab } from "./LoadoutTab";
import { encodeDeckSchemeCode } from "../lib/schemeShare";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

type DeckAffixDraft = AffixDraft<string>;

const AFFIX_ROW_COUNT = 6;

type DeckDraft = {
  name: string;
  note: string;
  affixes: DeckAffixDraft[];
};

function emptyAffixRows(): DeckAffixDraft[] {
  return Array.from({ length: AFFIX_ROW_COUNT }, () => ({
    stat: "",
    value: 0,
  }));
}

function fillAffixRows(
  list: DeckPiece["affixes"] | undefined,
): DeckAffixDraft[] {
  const next = emptyAffixRows();
  (list ?? []).slice(0, AFFIX_ROW_COUNT).forEach((affix, i) => {
    next[i] = { stat: affix.stat, value: affix.value };
  });
  return next;
}

function cleanAffixRows(
  rows: DeckAffixDraft[],
): Array<{ stat: InsigniaStatKey; value: number }> {
  return rows
    .filter((s): s is { stat: InsigniaStatKey; value: number } => {
      if (!s.stat) return false;
      return Number.isFinite(s.value);
    })
    .slice(0, AFFIX_ROW_COUNT)
    .map((r) => ({ stat: r.stat as InsigniaStatKey, value: r.value }));
}

export function DeckTab() {
  const { m } = useI18n();
  const {
    decks,
    deckSchemes: schemes,
    setDecks,
    setDeckSchemes: setSchemes,
    activeProfile,
    setStatus: onStatus,
    importDeckSchemeFromCode: onImportShareCode,
    profileResult,
    updateProfile,
  } = useAppStore();

  const decksById = useMemo(() => {
    const map = new Map<string, DeckPiece>();
    for (const p of decks) map.set(p.id, p);
    return map;
  }, [decks]);

  function duplicatePiece(piece: DeckPiece): void {
    const copy: DeckPiece = {
      ...structuredClone(piece),
      id: blankDeckPiece().id,
      name: `${piece.name || defaultDeckName(piece)}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDecks((list) => [copy, ...list]);
    onStatus(m.copiedDeck(copy.name));
  }

  const config: LoadoutConfig<
    DeckPiece,
    DeckScheme,
    DeckSlotId,
    InsigniaStatKey,
    DeckDraft,
    ReturnType<typeof schemeContribution>["extra"],
    ReturnType<typeof compareSchemeDecks>
  > = {
    formTitle: (editing) => (editing ? m.editDeck : m.addDeck),
    formHint: m.deckFormHint,
    addLabel: m.addDeck,
    namePlaceholder: m.autoNameDeckPh,
    libTitle: m.deckLib,
    libraryTitle: m.allDecks,
    noLibMsg: m.noDecks,
    searchPlaceholder: m.searchDecks,
    schemesTitle: m.deckSchemes,
    schemesHint: m.deckSchemeHint,
    noSchemesMsg: m.noDeckSchemes,
    schemes: schemes,
    pieces: decks,
    piecesById: decksById,
    contribEmptyMsg: m.noDeckDamage,
    schemeShareKind: "deck",
    gainTitle: m.deckGainTitle,
    gainHintWith: m.deckGainHintWith,
    gainHintEmpty: m.deckGainHintEmpty,
    equippedHeader: m.equippedSection,
    emptyHint: m.notSocketedYet,
    previewNoLabel: m.previewNoDeck,
    previewGainLabel: m.previewDeckGain,

    blankDraft: () => ({
      name: "",
      note: "",
      affixes: emptyAffixRows(),
    }),
    loadDraft: (piece) => ({
      name: piece.name,
      note: piece.note,
      affixes: fillAffixRows(piece.affixes),
    }),
    onSave: (draft, editingId) => {
      const cleaned = cleanAffixRows(draft.affixes);
      const draft2: DeckPiece = {
        id: editingId ?? blankDeckPiece().id,
        name: draft.name.trim(),
        affixes: cleaned,
        note: draft.note.trim(),
        createdAt:
          decks.find((p) => p.id === editingId)?.createdAt ??
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!draft2.name) draft2.name = defaultDeckName(draft2);
      setDecks((list) => {
        const idx = list.findIndex((p) => p.id === draft2.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = draft2;
          return next;
        }
        return [draft2, ...list];
      });
      onStatus(
        editingId ? m.updatedDeck(draft2.name) : m.addedDeck(draft2.name),
      );
    },
    getName: (d) => d.name,
    setName: (d, name) => ({ ...d, name }),
    deletePiece: (id) => {
      const piece = decksById.get(id);
      setDecks((list) => list.filter((p) => p.id !== id));
      setSchemes((list) => detachDecksFromSchemes(list, new Set([id])));
      onStatus(m.deletedDeck(piece?.name || id));
    },
    exportActiveScheme: (scheme) =>
      encodeDeckSchemeCode(scheme, decksById),
    onImportShareCode,
    renderFields: (draft, setDraft) => (
      <>
        <label>
          {m.note}
          <input
            value={draft.note}
            onChange={(e) =>
              setDraft((d) => ({ ...d, note: e.target.value }))
            }
            placeholder={m.insigniaNotePh}
          />
        </label>
        <p className="muted small">{m.deckAffixHint}</p>
      </>
    ),
    affixBlocks: [
      {
        title: m.effectsMax6,
        hint: m.effectsHint,
        rowLabel: m.subStat,
        options: DECK_STAT_OPTIONS as string[],
        percentSet: DECK_PERCENT_STATS as Set<string>,
        labelFor: (s) => deckStatLabel(s as InsigniaStatKey),
        suffixFor: (s) =>
          s === "elementalPower" ||
          s === "ice" ||
          s === "fire" ||
          s === "electric" ||
          s === "dark"
            ? m.elemPoints
            : "",
        rowHeader: (i) => m.effectN(i + 1),
        getRows: (d) => d.affixes,
        setRows: (d, rows) => ({ ...d, affixes: rows }),
      },
    ],

    pieceStatLines: (piece) => piece.affixes.map((a) => formatDeckAffix(a)),
    cardPills: () => null,
    cardCanSocket: () => "",
    cardNote: (piece) => piece.note || undefined,
    extraCardActions: (piece) => (
      <button
        type="button"
        className="secondary"
        onClick={() => duplicatePiece(piece)}
      >
        {m.copy}
      </button>
    ),
    renderFilterSelects: () => null,
    applyFilters: (pieces, ctx) => {
      const q = ctx.search.trim().toLowerCase();
      const list = pieces.filter((p) => {
        if (!q) return true;
        const label = (p.name || defaultDeckName(p)).toLowerCase();
        const hay = [
          label,
          ...p.affixes.map((a) => a.stat),
          p.note,
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
      `${scheme.name}（${equippedCount(scheme)}/4）`,
    isApplied: (profile, schemeId) =>
      !!profile && profile.deckSchemeId === schemeId,
    getProfileSchemeId: (profile) => profile?.deckSchemeId ?? null,
    applyToProfile: (schemeId) => {
      if (!activeProfile) {
        onStatus(m.pickProfileFirst);
        return;
      }
      updateProfile(activeProfile.id, { deckSchemeId: schemeId });
    },
    addScheme: () => {
      const scheme = blankDeckScheme(
        m.defaultSchemeName(schemes.length + 1),
      );
      setSchemes((list) => [scheme, ...list]);
      onStatus(m.addedDeckScheme);
      return scheme.id;
    },
    duplicateScheme: (scheme) => {
      const copy: DeckScheme = {
        ...structuredClone(scheme),
        id: blankDeckScheme().id,
        name: `${scheme.name}${m.copiedSuffix}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSchemes((list) => [copy, ...list]);
      onStatus(m.copiedDeckScheme);
      return copy.id;
    },
    deleteScheme: (id) => {
      setSchemes((list) => list.filter((s) => s.id !== id));
      onStatus(m.deletedDeckScheme);
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
      if (!profile || decks.length === 0) return null;
      const scheme2 = scheme ?? blankDeckScheme(m.emptySchemeName);
      return compareSchemeDecks(
        scheme2,
        decks,
        decksById,
        (next) =>
          profileResult(profile, undefined, undefined, undefined, next)
            .finalDamage,
      );
    },
    computePreview: (scheme, profile) => ({
      withScheme: profileResult(profile, undefined, undefined, undefined, scheme),
      without: profileResult(profile, undefined, undefined, undefined, null),
    }),
    shouldShowGainPanel: (profile, comparison) =>
      !!profile && !!comparison,
    gainFallback: (profile, activeScheme) =>
      !profile ? (
        <p className="muted small">
          {activeScheme ? m.pickProfileDeckCompare : m.soloBeforeScheme}
        </p>
      ) : activeScheme && decks.length === 0 ? (
        <p className="muted small">{m.addDeckToCompare}</p>
      ) : null,

    slotDefs: DECK_SLOT_IDS.map((id) => ({ id })),
    slotFilledClass: (current) => (current ? "filled" : ""),
    slotPill: () => null,
    slotOptions: (slot, currentId, ctx) => {
      const slotGains = ctx.comparison?.bySlot.get(slot) ?? [];
      const gainByPieceId = new Map(
        slotGains.map((g) => [g.pieceId, g]),
      );
      const options = decks
        .filter((p) => canSocketIn(p, slot) || p.id === currentId)
        .sort((a, b) => {
          if (a.id === currentId) return -1;
          if (b.id === currentId) return 1;
          const ga =
            gainByPieceId.get(a.id)?.delta ?? Number.NEGATIVE_INFINITY;
          const gb =
            gainByPieceId.get(b.id)?.delta ?? Number.NEGATIVE_INFINITY;
          return gb - ga;
        });
      return options.map((p) => {
        const gain = gainByPieceId.get(p.id);
        const gainText =
          gain && p.id !== currentId
            ? ` · ${formatSignedDamage(gain.delta)}`
            : "";
        return {
          id: p.id,
          label: `${p.name || defaultDeckName(p)}${gainText}`,
          gainText,
        };
      });
    },
    slotBody: (slot, current, ctx) => {
      const slotGains = ctx.comparison?.bySlot.get(slot) ?? [];
      const slotGain = current
        ? new Map(slotGains.map((g) => [g.pieceId, g])).get(current.id)
        : undefined;
      return (
        <small className="circuit-slot-main">
          {current.affixes[0]
            ? formatDeckAffix(current.affixes[0])
            : m.noEffect}
          {current.affixes.length > 1
            ? m.moreEffects(current.affixes.length - 1)
            : ""}
          {slotGain ? (
            <>
              {" · "}
              <span className={gainClass(slotGain.delta)}>
                {formatSignedDamage(slotGain.delta)}（
                {formatSignedRatio(slotGain.ratio)}）
              </span>
            </>
          ) : null}
        </small>
      );
    },
    emptySlotHint: (_slot, optionCount) =>
      optionCount ? m.nCanFit(optionCount) : m.noneForSlot,
    equipSlot: (schemeId, slot, id) => {
      setSchemes((list) =>
        list.map((s) =>
          s.id === schemeId ? assignDeckToSlot(s, slot, id) : s,
        ),
      );
    },

    gainRowMeta: (row) => ({
      pillClass: "",
      pillLabel: "",
      name: row.piece.name || defaultDeckName(row.piece),
    }),
    libraryGain: {
      rowMeta: (pieceId, piecesById) => {
        const p = piecesById.get(pieceId)!;
        return {
          pillClass: "",
          pillLabel: "",
          name: p.name || defaultDeckName(p),
        };
      },
    },
  };

  return <LoadoutTab config={config} />;
}

function librarySortValue(
  pieceId: string,
  equipped: Map<string, LoadoutSlotGain<DeckPiece, DeckSlotId>>,
  swaps: Map<string, LoadoutSwapGain<DeckSlotId>>,
): number {
  const row = equipped.get(pieceId);
  if (row) return row.delta;
  return swaps.get(pieceId)?.delta ?? Number.NEGATIVE_INFINITY;
}
