/** Unified percent-stat input parsing shared by Circuit and Insignia. */

/**
 * Convert a stored (fraction) value into the number shown in a form input.
 * Percent stats are stored as fractions (e.g. 0.1234) and shown on a
 * 0–100 scale (e.g. 12.34).
 */
export function statInputValue(
  key: string,
  stored: number,
  percentSet: Set<string>,
): number {
  if (!Number.isFinite(stored)) return 0;
  if (percentSet.has(key)) {
    return Math.round(stored * 10000) / 100;
  }
  return stored;
}

/** Parse a form input string back into the stored value. */
export function parseStatInput(
  key: string,
  raw: string,
  percentSet: Set<string>,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (percentSet.has(key)) return n / 100;
  return n;
}
