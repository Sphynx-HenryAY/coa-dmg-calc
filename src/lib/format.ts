import { formatDamage, formatRatio } from "./damage";

/** Trim a number for display: integers as-is, else up to 2 decimals. */
export function trimNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

export function formatSignedDamage(n: number): string {
  const abs = formatDamage(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export function formatSignedRatio(n: number): string {
  const abs = formatRatio(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export function gainClass(n: number): string {
  if (n > 0) return "gain-pos";
  if (n < 0) return "gain-neg";
  return "gain-zero";
}

/**
 * Generic slot-hint builder (e.g. "頭 / 手 / 腳").
 * `labelFor` maps a slot id to its display label; `unspecified` is used
 * when the list is empty.
 */
export function slotHint(
  slots: string[],
  labelFor: (slot: string) => string,
  unspecified = "",
): string {
  if (slots.length === 0) return unspecified;
  return slots.map(labelFor).join(" / ");
}

export type AffixLike = { stat: string; value: number };

/**
 * Shared core for `pieceStatLines`. Each group contributes formatted affix
 * lines; when `always` is set its affixes are emitted unconditionally
 * (used for a piece's main stat), otherwise zero/empty affixes are skipped.
 */
export function affixLines<A extends AffixLike>(
  groups: Array<{
    prefix: string;
    affixes: A[];
    always?: boolean;
  }>,
  formatAffix: (a: A) => string,
): string[] {
  const lines: string[] = [];
  for (const g of groups) {
    for (const a of g.affixes) {
      if (!g.always && (!a.stat || !Number.isFinite(a.value) || a.value === 0)) {
        continue;
      }
      lines.push(`${g.prefix}${formatAffix(a)}`);
    }
  }
  return lines;
}
