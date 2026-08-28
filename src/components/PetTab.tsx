import { useMemo } from "react";
import type {
  InsigniaStatKey,
  PetPiece,
  PetScheme,
  PetSlotId,
} from "../lib/types";
import { formatSignedDamage, formatSignedRatio, gainClass } from "../lib/format";
import {
  PET_PERCENT_STATS,
  PET_SLOT_IDS,
  PET_STAT_OPTIONS,
  assignPetToSlot,
  blankPetPiece,
  blankPetScheme,
  canSocketIn,
  compareSchemePets,
  contributionLines,
  defaultPetName,
  detachPetsFromSchemes,
  equippedCount,
  formatPetAffix,
  petStatLabel,
  schemeContribution,
} from "../lib/pet";
import { type LoadoutSlotGain, type LoadoutSwapGain } from "../lib/loadout";
import { type AffixDraft } from "./forms";
import { type LoadoutConfig, LoadoutTab } from "./LoadoutTab";
import { encodePetSchemeCode } from "../lib/schemeShare";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

type PetAffixDraft = AffixDraft<string>;

const AFFIX_ROW_COUNT = 6;

type PetDraft = {
  name: string;
  note: string;
  affixes: PetAffixDraft[];
};

function emptyAffixRows(): PetAffixDraft[] {
  return Array.from({ length: AFFIX_ROW_COUNT }, () => ({
    stat: "",
    value: 0,
  }));
}

function fillAffixRows(
  list: PetPiece["affixes"] | undefined,
): PetAffixDraft[] {
  const next = emptyAffixRows();
  (list ?? []).slice(0, AFFIX_ROW_COUNT).forEach((affix, i) => {
    next[i] = { stat: affix.stat, value: affix.value };
  });
  return next;
}

function cleanAffixRows(
  rows: PetAffixDraft[],
): Array<{ stat: InsigniaStatKey; value: number }> {
  return rows
    .filter((s): s is { stat: InsigniaStatKey; value: number } => {
      if (!s.stat) return false;
      return Number.isFinite(s.value);
    })
    .slice(0, AFFIX_ROW_COUNT)
    .map((r) => ({ stat: r.stat as InsigniaStatKey, value: r.value }));
}

export function PetTab() {
  const { m } = useI18n();
  const {
    pets,
    petSchemes: schemes,
    setPets,
    setPetSchemes: setSchemes,
    activeProfile,
    setStatus: onStatus,
    importPetSchemeFromCode: onImportShareCode,
    profileResult,
    updateProfile,
  } = useAppStore();

  const petsById = useMemo(() => {
    const map = new Map<string, PetPiece>();
    for (const p of pets) map.set(p.id, p);
    return map;
  }, [pets]);

  function duplicatePiece(piece: PetPiece): void {
    const copy: PetPiece = {
      ...structuredClone(piece),
      id: blankPetPiece().id,
      name: `${piece.name || defaultPetName(piece)}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPets((list) => [copy, ...list]);
    onStatus(m.copiedPet(copy.name));
  }

  const config: LoadoutConfig<
    PetPiece,
    PetScheme,
    PetSlotId,
    InsigniaStatKey,
    PetDraft,
    ReturnType<typeof schemeContribution>["extra"],
    ReturnType<typeof compareSchemePets>
  > = {
    formTitle: (editing) => (editing ? m.editPet : m.addPet),
    formHint: m.petFormHint,
    addLabel: m.addPet,
    namePlaceholder: m.autoNamePetPh,
    libTitle: m.petLib,
    libraryTitle: m.allPets,
    noLibMsg: m.noPets,
    searchPlaceholder: m.searchPets,
    schemesTitle: m.petSchemes,
    schemesHint: m.petSchemeHint,
    noSchemesMsg: m.noPetSchemes,
    schemes: schemes,
    pieces: pets,
    piecesById: petsById,
    contribEmptyMsg: m.noPetDamage,
    schemeShareKind: "pet",
    gainTitle: m.petGainTitle,
    gainHintWith: m.petGainHintWith,
    gainHintEmpty: m.petGainHintEmpty,
    equippedHeader: m.equippedSection,
    emptyHint: m.notSocketedPet,
    previewNoLabel: m.previewNoPet,
    previewGainLabel: m.previewPetGain,

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
      const draft2: PetPiece = {
        id: editingId ?? blankPetPiece().id,
        name: draft.name.trim(),
        affixes: cleaned,
        note: draft.note.trim(),
        createdAt:
          pets.find((p) => p.id === editingId)?.createdAt ??
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!draft2.name) draft2.name = defaultPetName(draft2);
      setPets((list) => {
        const idx = list.findIndex((p) => p.id === draft2.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = draft2;
          return next;
        }
        return [draft2, ...list];
      });
      onStatus(
        editingId ? m.updatedPet(draft2.name) : m.addedPet(draft2.name),
      );
    },
    getName: (d) => d.name,
    setName: (d, name) => ({ ...d, name }),
    deletePiece: (id) => {
      const piece = petsById.get(id);
      setPets((list) => list.filter((p) => p.id !== id));
      setSchemes((list) => detachPetsFromSchemes(list, new Set([id])));
      onStatus(m.deletedPet(piece?.name || id));
    },
    exportActiveScheme: (scheme) => encodePetSchemeCode(scheme, petsById),
    onImportShareCode,
    renderFields: (draft, setDraft) => (
      <>
        <label>
          {m.note}
          <input
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder={m.petNotePh}
          />
        </label>
        <p className="muted small">{m.petAffixHint}</p>
      </>
    ),
    affixBlocks: [
      {
        title: m.effectsMax6,
        hint: m.effectsHint,
        rowLabel: m.subStat,
        options: PET_STAT_OPTIONS as string[],
        percentSet: PET_PERCENT_STATS as Set<string>,
        labelFor: (s) => petStatLabel(s as InsigniaStatKey),
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

    pieceStatLines: (piece) => piece.affixes.map((a) => formatPetAffix(a)),
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
        const label = (p.name || defaultPetName(p)).toLowerCase();
        const hay = [label, ...p.affixes.map((a) => a.stat), p.note]
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
      `${scheme.name}（${equippedCount(scheme)}/2）`,
    isApplied: (profile, schemeId) =>
      !!profile && profile.petSchemeId === schemeId,
    getProfileSchemeId: (profile) => profile?.petSchemeId ?? null,
    applyToProfile: (schemeId) => {
      if (!activeProfile) {
        onStatus(m.pickProfileFirst);
        return;
      }
      updateProfile(activeProfile.id, { petSchemeId: schemeId });
    },
    addScheme: () => {
      const scheme = blankPetScheme(m.defaultSchemeName(schemes.length + 1));
      setSchemes((list) => [scheme, ...list]);
      onStatus(m.addedPetScheme);
      return scheme.id;
    },
    duplicateScheme: (scheme) => {
      const copy: PetScheme = {
        ...structuredClone(scheme),
        id: blankPetScheme().id,
        name: `${scheme.name}${m.copiedSuffix}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSchemes((list) => [copy, ...list]);
      onStatus(m.copiedPetScheme);
      return copy.id;
    },
    deleteScheme: (id) => {
      setSchemes((list) => list.filter((s) => s.id !== id));
      onStatus(m.deletedPetScheme);
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
      if (!profile || pets.length === 0) return null;
      const scheme2 = scheme ?? blankPetScheme(m.emptySchemeName);
      return compareSchemePets(
        scheme2,
        pets,
        petsById,
        (next) => profileResult(profile, undefined, undefined, undefined, next).finalDamage,
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
          {activeScheme ? m.pickProfilePetCompare : m.soloBeforeScheme}
        </p>
      ) : activeScheme && pets.length === 0 ? (
        <p className="muted small">{m.addPetToCompare}</p>
      ) : null,

    slotDefs: PET_SLOT_IDS.map((id) => ({ id })),
    slotFilledClass: (current) => (current ? "filled" : ""),
    slotPill: () => null,
    slotOptions: (slot, currentId, ctx) => {
      const slotGains = ctx.comparison?.bySlot.get(slot) ?? [];
      const gainByPieceId = new Map(slotGains.map((g) => [g.pieceId, g]));
      const options = pets
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
          label: `${p.name || defaultPetName(p)}${gainText}`,
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
          {current.affixes.length > 0
            ? current.affixes.map((a, i) => (
                <span key={i}>
                  {i > 0 ? " · " : ""}
                  {formatPetAffix(a)}
                </span>
              ))
            : m.noEffect}
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
      optionCount ? m.nCanFit(optionCount) : m.noneForPetSlot,
    equipSlot: (schemeId, slot, id) => {
      setSchemes((list) =>
        list.map((s) =>
          s.id === schemeId ? assignPetToSlot(s, slot, id) : s,
        ),
      );
    },

    gainRowMeta: (row) => ({
      pillClass: "",
      pillLabel: "",
      name: row.piece.name || defaultPetName(row.piece),
    }),
    libraryGain: {
      rowMeta: (pieceId, piecesById) => {
        const p = piecesById.get(pieceId)!;
        return {
          pillClass: "",
          pillLabel: "",
          name: p.name || defaultPetName(p),
        };
      },
    },
  };

  return <LoadoutTab config={config} />;
}

function librarySortValue(
  pieceId: string,
  equipped: Map<string, LoadoutSlotGain<PetPiece, PetSlotId>>,
  swaps: Map<string, LoadoutSwapGain<PetSlotId>>,
): number {
  const row = equipped.get(pieceId);
  if (row) return row.delta;
  return swaps.get(pieceId)?.delta ?? Number.NEGATIVE_INFINITY;
}
