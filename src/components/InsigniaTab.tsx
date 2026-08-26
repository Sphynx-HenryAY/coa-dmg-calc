import { useMemo, useState } from "react";
import type {
  InsigniaPiece,
  InsigniaRank,
  InsigniaRarity,
  InsigniaScheme,
  InsigniaSlotId,
  InsigniaStatKey,
} from "../lib/types";
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
} from "../lib/insignia";
import { type LoadoutSlotGain, type LoadoutSwapGain } from "../lib/loadout";
import { type AffixDraft } from "./forms";
import { type LoadoutConfig, LoadoutTab } from "./LoadoutTab";
import { encodeInsigniaSchemeCode } from "../lib/schemeShare";
import {
  insigniaRarityLabel,
  insigniaStatLabel,
  slotLabel,
} from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

type AffixDraft2 = AffixDraft<string>;

const RARITY_OPTIONS: InsigniaRarity[] = ["epic", "rare"];
const AFFIX_ROW_COUNT = 6;

type InsigniaDraft = {
  name: string;
  rarity: InsigniaRarity;
  slots: InsigniaSlotId[];
  rank: InsigniaRank;
  note: string;
  affixes: AffixDraft2[];
};

function emptyAffixRows(): AffixDraft2[] {
  return Array.from({ length: AFFIX_ROW_COUNT }, () => ({
    stat: "",
    value: 0,
  }));
}

function fillAffixRows(list: InsigniaPiece["affixes"] | undefined): AffixDraft2[] {
  const next = emptyAffixRows();
  (list ?? []).slice(0, AFFIX_ROW_COUNT).forEach((affix, i) => {
    next[i] = { stat: affix.stat, value: affix.value };
  });
  return next;
}

function cleanAffixRows(
  rows: AffixDraft2[],
): Array<{ stat: InsigniaStatKey; value: number }> {
  return rows
    .filter((s): s is { stat: InsigniaStatKey; value: number } => {
      if (!s.stat) return false;
      return Number.isFinite(s.value);
    })
    .slice(0, AFFIX_ROW_COUNT)
    .map((r) => ({ stat: r.stat as InsigniaStatKey, value: r.value }));
}

export function InsigniaTab() {
  const { m } = useI18n();
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

  const insigniasById = useMemo(() => {
    const map = new Map<string, InsigniaPiece>();
    for (const p of insignias) map.set(p.id, p);
    return map;
  }, [insignias]);

  const [rarityFilter, setRarityFilter] = useState<InsigniaRarity | "all">(
    "all",
  );
  const [slotFilter, setSlotFilter] = useState<InsigniaSlotId | "all">("all");

  function toggleSlot(
    _draft: InsigniaDraft,
    setDraft: React.Dispatch<React.SetStateAction<InsigniaDraft>>,
    slot: InsigniaSlotId,
  ): void {
    setDraft((d) => ({
      ...d,
      slots: d.slots.includes(slot)
        ? d.slots.filter((s) => s !== slot)
        : [...d.slots, slot],
    }));
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

  const config: LoadoutConfig<
    InsigniaPiece,
    InsigniaScheme,
    InsigniaSlotId,
    undefined,
    InsigniaDraft,
    ReturnType<typeof schemeContribution>["extra"],
    ReturnType<typeof compareSchemeInsignias>
  > = {
    formTitle: (editing) => (editing ? m.editInsignia : m.addInsignia),
    formHint: m.insigniaFormHint,
    addLabel: m.addInsignia,
    namePlaceholder: m.autoNameInsigniaPh,
    libTitle: m.insigniaLib,
    noLibMsg: m.noInsignias,
    searchPlaceholder: m.searchInsignias,
    schemesTitle: m.insigniaSchemes,
    schemesHint: m.insigniaSchemeHint,
    noSchemesMsg: m.noInsigniaSchemes,
    schemes: schemes,
    pieces: insignias,
    piecesById: insigniasById,
    contribEmptyMsg: m.noInsigniaDamage,
    schemeShareKind: "insignia",
    gainTitle: m.insigniaGainTitle,
    gainHintWith: m.insigniaGainHintWith,
    gainHintEmpty: m.insigniaGainHintEmpty,
    equippedHeader: m.equippedSection,
    emptyHint: m.notSocketedYet,
    previewNoLabel: m.previewNoInsignia,
    previewGainLabel: m.previewInsigniaGain,

    blankDraft: () => ({
      name: "",
      rarity: "epic",
      slots: [],
      rank: 3,
      note: "",
      affixes: emptyAffixRows(),
    }),
    loadDraft: (piece) => ({
      name: piece.name,
      rarity: piece.rarity,
      slots: [...piece.slots],
      rank: piece.rank,
      note: piece.note,
      affixes: fillAffixRows(piece.affixes),
    }),
    onSave: (draft, editingId) => {
      const cleaned = cleanAffixRows(draft.affixes);
      if (draft.slots.length === 0) {
        onStatus(m.needOneSlot);
        return;
      }
      const draft2: InsigniaPiece = {
        id: editingId ?? blankInsigniaPiece(draft.rarity).id,
        name: draft.name.trim(),
        rarity: draft.rarity,
        slots: INSIGNIA_SLOT_IDS.filter((s) => draft.slots.includes(s)),
        rank: draft.rank,
        affixes: cleaned,
        note: draft.note.trim(),
        createdAt:
          insignias.find((p) => p.id === editingId)?.createdAt ??
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!draft2.name) draft2.name = defaultInsigniaName(draft2);
      setInsignias((list) => {
        const idx = list.findIndex((p) => p.id === draft2.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = draft2;
          return next;
        }
        return [draft2, ...list];
      });
      onStatus(
        editingId
          ? m.updatedInsignia(draft2.name)
          : m.addedInsignia(draft2.name),
      );
    },
    getName: (d) => d.name,
    setName: (d, name) => ({ ...d, name }),
    deletePiece: (id) => {
      const piece = insigniasById.get(id);
      setInsignias((list) => list.filter((p) => p.id !== id));
      setSchemes((list) => detachInsigniasFromSchemes(list, [id]));
      onStatus(m.deletedInsignia(piece?.name || id));
    },
    exportActiveScheme: (scheme) =>
      encodeInsigniaSchemeCode(scheme, insigniasById),
    onImportShareCode,
    renderFields: (draft, setDraft) => (
      <>
        <label>
          {m.rarity}
          <select
            value={draft.rarity}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                rarity: e.target.value as InsigniaRarity,
              }))
            }
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
            value={draft.rank}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                rank: Number(e.target.value) as InsigniaRank,
              }))
            }
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
            value={draft.note}
            onChange={(e) =>
              setDraft((d) => ({ ...d, note: e.target.value }))
            }
            placeholder={m.insigniaNotePh}
          />
        </label>
        <h3 className="section-title">{m.socketSlots}</h3>
        <p className="muted small">{m.socketSlotsHint}</p>
        <div className="slot-chip-groups">
          {INSIGNIA_SLOT_GROUPS.map((group) => (
            <div key={group.group} className="slot-chip-group">
              <span className="muted small">{slotLabel(group.group)}</span>
              <div className="slot-chip-grid">
                {group.slots.map((slot) => {
                  const on = draft.slots.includes(slot);
                  return (
                    <label
                      key={slot}
                      className={`slot-chip ${on ? "on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleSlot(draft, setDraft, slot)}
                      />
                      {slotLabel(slot)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    ),
    affixBlocks: [
      {
        title: m.effectsMax6,
        hint: m.effectsHint,
        rowLabel: m.subStat,
        options: INSIGNIA_STAT_OPTIONS,
        percentSet: INSIGNIA_PERCENT_STATS,
        labelFor: (s) => insigniaStatLabel(s as InsigniaStatKey),
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

    pieceStatLines: (piece) => pieceStatLines(piece),
    cardPills: (piece) => (
      <>
        <span className={`kind-pill ${piece.rarity}`}>
          {insigniaRarityLabel(piece.rarity)}
        </span>{" "}
        <span className={`kind-pill rank`}>{m.rankN(piece.rank)}</span>
      </>
    ),
    cardCanSocket: (piece) => m.canSocket(slotHint(piece.slots)),
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
    renderFilterSelects: () => (
      <>
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
      </>
    ),
    applyFilters: (pieces, ctx) => {
      const q = ctx.search.trim().toLowerCase();
      const list = pieces.filter((p) => {
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
      `${scheme.name}（${equippedCount(scheme)}/11）`,
    isApplied: (profile, schemeId) =>
      !!profile && profile.insigniaSchemeId === schemeId,
    getProfileSchemeId: (profile) => profile?.insigniaSchemeId ?? null,
    applyToProfile: (schemeId) => {
      if (!activeProfile) {
        onStatus(m.pickProfileFirst);
        return;
      }
      updateProfile(activeProfile.id, { insigniaSchemeId: schemeId });
    },
    addScheme: () => {
      const scheme = blankInsigniaScheme(
        m.defaultSchemeName(schemes.length + 1),
      );
      setSchemes((list) => [scheme, ...list]);
      onStatus(m.addedInsigniaScheme);
      return scheme.id;
    },
    duplicateScheme: (scheme) => {
      const copy: InsigniaScheme = {
        ...structuredClone(scheme),
        id: blankInsigniaScheme().id,
        name: `${scheme.name}${m.copiedSuffix}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSchemes((list) => [copy, ...list]);
      onStatus(m.copiedInsigniaScheme);
      return copy.id;
    },
    deleteScheme: (id) => {
      setSchemes((list) => list.filter((s) => s.id !== id));
      onStatus(m.deletedInsigniaScheme);
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
      if (!profile || insignias.length === 0) return null;
      const scheme2 = scheme ?? blankInsigniaScheme(m.emptySchemeName);
      return compareSchemeInsignias(
        scheme2,
        insignias,
        insigniasById,
        (next) => profileResult(profile, undefined, next).finalDamage,
      );
    },
    computePreview: (scheme, profile) => ({
      withScheme: profileResult(profile, undefined, scheme),
      without: profileResult(profile, undefined, null),
    }),
    shouldShowGainPanel: (profile, comparison, _activeScheme) =>
      !!profile && !!comparison,
    gainFallback: (profile, activeScheme) =>
      !profile ? (
        <p className="muted small">
          {activeScheme ? m.pickProfileInsigniaCompare : m.soloBeforeScheme}
        </p>
      ) : activeScheme && insignias.length === 0 ? (
        <p className="muted small">{m.addInsigniaToCompare}</p>
      ) : null,

    slotDefs: INSIGNIA_SLOT_IDS.map((id) => ({ id })),
    slotFilledClass: (current) =>
      current ? `filled kind-${current.rarity}` : "",
    slotPill: (_slot, current) =>
      current ? (
        <span className={`kind-pill ${current.rarity}`}>
          {insigniaRarityLabel(current.rarity)}
        </span>
      ) : null,
    slotOptions: (slot, currentId, ctx) => {
      const slotGains = ctx.comparison?.bySlot.get(slot) ?? [];
      const gainByPieceId = new Map(
        slotGains.map((g) => [g.pieceId, g]),
      );
      const options = insignias
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
          label: `${p.name || defaultInsigniaName(p)} · ${m.rankShort(
            p.rank,
          )}`,
          gainText,
        };
      });
    },
    slotBody: (slot, current, ctx) => {
      const slotGains = ctx.comparison?.bySlot.get(slot) ?? [];
      const slotGain = current
        ? new Map(slotGains.map((g) => [g.pieceId, g])).get(current.id)
        : undefined;
      const slotMismatch = !!(current && !canSocketIn(current, slot));
      return (
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
      );
    },
    emptySlotHint: (_slot, optionCount) =>
      optionCount ? m.nCanFit(optionCount) : m.noneForSlot,
    equipSlot: (schemeId, slot, id) => {
      setSchemes((list) =>
        list.map((s) =>
          s.id === schemeId ? assignInsigniaToSlot(s, slot, id) : s,
        ),
      );
    },

    gainRowMeta: (row) => ({
      pillClass: row.piece.rarity,
      pillLabel: insigniaRarityLabel(row.piece.rarity),
      name: row.piece.name || defaultInsigniaName(row.piece),
    }),
    libraryGain: {
      rowMeta: (pieceId, piecesById) => {
        const p = piecesById.get(pieceId)!;
        return {
          pillClass: p.rarity,
          pillLabel: insigniaRarityLabel(p.rarity),
          name: p.name || defaultInsigniaName(p),
        };
      },
    },
  };

  return <LoadoutTab config={config} />;
}

function librarySortValue(
  pieceId: string,
  equipped: Map<string, LoadoutSlotGain<InsigniaPiece, InsigniaSlotId>>,
  swaps: Map<string, LoadoutSwapGain<InsigniaSlotId>>,
): number {
  const row = equipped.get(pieceId);
  if (row) return row.delta;
  return swaps.get(pieceId)?.delta ?? Number.NEGATIVE_INFINITY;
}
