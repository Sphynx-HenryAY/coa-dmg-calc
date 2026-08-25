import type { StatBag } from "./types";

/**
 * Generic, type-parameterized core shared by the Circuit and Insignia loadout
 * engines. Domain modules (circuit.ts / insignia.ts) define their concrete
 * types and the few stat-mapping callbacks that differ, then delegate the
 * duplicated algorithms here.
 *
 * Only the management algorithms are unified here (scheme contribution,
 * equipped counting, listing, unequip, slot assignment, detach, and the
 * leave-one-out / solo / swap comparison). The stat-bag mapping (applyXxxAffix)
 * and extra-stat accumulation remain domain-specific, because their shapes and
 * field sets differ.
 */

export type LoadoutSlotId = string;

export interface LoadoutScheme<SlotId extends string = LoadoutSlotId> {
  equipped: Partial<Record<SlotId, string | null>>;
  updatedAt?: string;
}

export type LoadoutContribution<Extra> = {
  bag: StatBag;
  extra: Extra;
};

export type LoadoutEquipped<Piece, SlotId extends string> = {
  slot: SlotId;
  piece: Piece;
};

export type LoadoutSlotGain<Piece, SlotId extends string> = {
  slot: SlotId;
  piece: Piece;
  withoutDamage: number;
  delta: number;
  ratio: number;
  shareOfTotal: number;
  soloDamage: number;
  soloDelta: number;
  soloRatio: number;
};

export type LoadoutSwapGain<SlotId extends string> = {
  pieceId: string;
  slot: SlotId;
  action: "add" | "swap" | "keep";
  replacedId: string | null;
  newDamage: number;
  delta: number;
  ratio: number;
};

export type LoadoutComparison<Piece, SlotId extends string> = {
  fullDamage: number;
  noneDamage: number;
  totalDelta: number;
  totalRatio: number;
  equipped: LoadoutSlotGain<Piece, SlotId>[];
  byPieceId: Map<string, LoadoutSwapGain<SlotId>>;
  bySlot: Map<SlotId, LoadoutSwapGain<SlotId>[]>;
};

/** Add a numeric value to a bag key, ignoring zeros. Shared by both domains. */
export function addToBag(bag: StatBag, key: keyof StatBag, value: number): void {
  if (!value) return;
  const prev = (bag[key] as number | undefined) ?? 0;
  (bag as Record<string, number>)[key] = prev + value;
}

export interface SchemeConfig<Piece, SlotId extends string, Extra, Element> {
  slotIds: SlotId[];
  isSocketValid: (piece: Piece, slot: SlotId) => boolean;
  pieceContribution: (
    piece: Piece,
    element: Element,
  ) => LoadoutContribution<Extra>;
  emptyExtra: () => Extra;
  mergeExtra: (a: Extra, b: Extra) => Extra;
}

export function genericSchemeContribution<
  Piece,
  SlotId extends string,
  Extra,
  Element,
>(
  scheme: LoadoutScheme<SlotId>,
  piecesById: Map<string, Piece>,
  cfg: SchemeConfig<Piece, SlotId, Extra, Element>,
  element: Element,
): LoadoutContribution<Extra> {
  const bag: StatBag = {};
  let extra = cfg.emptyExtra();
  const seen = new Set<string>();

  for (const slot of cfg.slotIds) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    if (!cfg.isSocketValid(piece, slot)) continue;
    seen.add(id);
    const part = cfg.pieceContribution(piece, element);
    extra = cfg.mergeExtra(extra, part.extra);
    for (const [k, v] of Object.entries(part.bag) as Array<
      [keyof StatBag, number]
    >) {
      addToBag(bag, k, v);
    }
  }

  return { bag, extra };
}

export function countEquipped<SlotId extends string>(
  scheme: LoadoutScheme<SlotId>,
  slotIds: SlotId[],
): number {
  let n = 0;
  for (const slot of slotIds) {
    if (scheme.equipped[slot]) n += 1;
  }
  return n;
}

export function listEquipped<Piece, SlotId extends string>(
  scheme: LoadoutScheme<SlotId>,
  piecesById: Map<string, Piece>,
  slotIds: SlotId[],
  isSocketValid: (piece: Piece, slot: SlotId) => boolean,
): LoadoutEquipped<Piece, SlotId>[] {
  const seen = new Set<string>();
  const out: LoadoutEquipped<Piece, SlotId>[] = [];
  for (const slot of slotIds) {
    const id = scheme.equipped[slot];
    if (!id || seen.has(id)) continue;
    const piece = piecesById.get(id);
    if (!piece) continue;
    if (!isSocketValid(piece, slot)) continue;
    seen.add(id);
    out.push({ slot, piece });
  }
  return out;
}

export function unequipPiece<Scheme extends LoadoutScheme<SlotId>, SlotId extends string>(
  scheme: Scheme,
  slotIds: SlotId[],
  pieceId: string,
): Scheme {
  const equipped = { ...scheme.equipped };
  let changed = false;
  for (const slot of slotIds) {
    if (equipped[slot] === pieceId) {
      equipped[slot] = null;
      changed = true;
    }
  }
  return changed
    ? ({ ...scheme, equipped, updatedAt: new Date().toISOString() } as Scheme)
    : scheme;
}

export function assignToSlot<Scheme extends LoadoutScheme<SlotId>, SlotId extends string>(
  scheme: Scheme,
  slotIds: SlotId[],
  slot: SlotId,
  pieceId: string | null,
): Scheme {
  const equipped = { ...scheme.equipped };
  if (pieceId) {
    for (const s of slotIds) {
      if (equipped[s] === pieceId) equipped[s] = null;
    }
    equipped[slot] = pieceId;
  } else {
    equipped[slot] = null;
  }
  return {
    ...scheme,
    equipped,
    updatedAt: new Date().toISOString(),
  };
}

export function detachFromSchemes<
  Scheme extends LoadoutScheme<SlotId>,
  SlotId extends string,
>(
  schemes: Scheme[],
  slotIds: SlotId[],
  ids: string[],
): Scheme[] {
  const idSet = new Set(ids);
  return schemes.map((scheme) => {
    let changed = false;
    const equipped = { ...scheme.equipped };
    for (const slot of slotIds) {
      const id = equipped[slot];
      if (id && idSet.has(id)) {
        equipped[slot] = null;
        changed = true;
      }
    }
    return changed
      ? ({ ...scheme, equipped, updatedAt: new Date().toISOString() } as Scheme)
      : scheme;
  });
}

export function soloSchemeFor<
  Scheme extends LoadoutScheme<SlotId>,
  SlotId extends string,
>(scheme: Scheme, slot: SlotId, pieceId: string): Scheme {
  return { ...scheme, equipped: { [slot]: pieceId } } as Scheme;
}

export interface CompareConfig<Piece, SlotId extends string> {
  slotIds: SlotId[];
  isSocketValid: (piece: Piece, slot: SlotId) => boolean;
  slotsForPiece: (piece: Piece) => SlotId[];
}

/**
 * Leave-one-out, solo, and best add/swap placement for every piece in the
 * library. `bySlot` is always computed; domains that don't expose it simply
 * discard it.
 */
export function compareLoadout<
  Scheme extends LoadoutScheme<SlotId>,
  Piece extends { id: string },
  SlotId extends string,
>(
  scheme: Scheme,
  pieces: Piece[],
  piecesById: Map<string, Piece>,
  damageOf: (scheme: Scheme | null) => number,
  cfg: CompareConfig<Piece, SlotId>,
): LoadoutComparison<Piece, SlotId> {
  const fullDamage = damageOf(scheme);
  const noneDamage = damageOf(null);
  const totalDelta = fullDamage - noneDamage;
  const totalRatio = noneDamage > 0 ? fullDamage / noneDamage - 1 : 0;
  const equippedRefs = listEquipped(
    scheme,
    piecesById,
    cfg.slotIds,
    cfg.isSocketValid,
  );
  const soloCache = new Map<string, number>();

  const equipped: LoadoutSlotGain<Piece, SlotId>[] = equippedRefs.map(
    ({ slot, piece }) => {
      const withoutDamage = damageOf(unequipPiece(scheme, cfg.slotIds, piece.id));
      const delta = fullDamage - withoutDamage;
      let soloDamage = soloCache.get(piece.id);
      if (soloDamage === undefined) {
        const soloScheme = soloSchemeFor(scheme, slot, piece.id);
        soloDamage = damageOf(soloScheme);
        soloCache.set(piece.id, soloDamage);
      }
      return {
        slot,
        piece,
        withoutDamage,
        delta,
        ratio: withoutDamage > 0 ? fullDamage / withoutDamage - 1 : 0,
        shareOfTotal: totalDelta !== 0 ? delta / totalDelta : 0,
        soloDamage,
        soloDelta: soloDamage - noneDamage,
        soloRatio: noneDamage > 0 ? soloDamage / noneDamage - 1 : 0,
      };
    },
  );

  equipped.sort(
    (a, b) => b.delta - a.delta || b.soloDelta - a.soloDelta,
  );

  const byPieceId = new Map<string, LoadoutSwapGain<SlotId>>();
  const bySlot = new Map<SlotId, LoadoutSwapGain<SlotId>[]>();
  for (const slot of cfg.slotIds) bySlot.set(slot, []);

  for (const piece of pieces) {
    const slots = cfg.slotsForPiece(piece);
    if (slots.length === 0) continue;
    let best: LoadoutSwapGain<SlotId> | null = null;
    for (const slot of slots) {
      const occupantId = scheme.equipped[slot] ?? null;
      const next = assignToSlot(scheme, cfg.slotIds, slot, piece.id);
      const newDamage = damageOf(next);
      const action: LoadoutSwapGain<SlotId>["action"] =
        occupantId === piece.id ? "keep" : occupantId ? "swap" : "add";
      const candidate: LoadoutSwapGain<SlotId> = {
        pieceId: piece.id,
        slot,
        action,
        replacedId: action === "swap" ? occupantId : null,
        newDamage,
        delta: newDamage - fullDamage,
        ratio: fullDamage > 0 ? newDamage / fullDamage - 1 : 0,
      };
      bySlot.get(slot)!.push(candidate);
      if (
        !best ||
        candidate.newDamage > best.newDamage ||
        (candidate.newDamage === best.newDamage && candidate.action === "keep")
      ) {
        best = candidate;
      }
    }
    if (best) byPieceId.set(piece.id, best);
  }

  for (const list of bySlot.values()) {
    list.sort(
      (a, b) =>
        b.newDamage - a.newDamage ||
        Number(a.action === "keep") - Number(b.action === "keep"),
    );
  }

  return {
    fullDamage,
    noneDamage,
    totalDelta,
    totalRatio,
    equipped,
    byPieceId,
    bySlot,
  };
}
