export type ConfigDamageSource = "observed" | "formula";

export type ConfigDamage = {
  value: number;
  source: ConfigDamageSource;
};

/** Prefer the dummy number bound to the build; fall back to the formula. */
export function configCompareDamage(
  observed: number | null | undefined,
  formulaTraining: number,
): ConfigDamage {
  if (typeof observed === "number" && Number.isFinite(observed) && observed > 0) {
    return { value: observed, source: "observed" };
  }
  const formula = Number.isFinite(formulaTraining) ? Math.max(formulaTraining, 0) : 0;
  return { value: formula, source: "formula" };
}

export function parseObservedDamage(raw: unknown): number | null {
  if (raw === "" || raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type ConfigRankRow<T> = T & {
  rank: number;
  ratioOfBest: number;
  ratioOfBaseline: number;
};

export function rankConfigDamage<T extends { damage: number }>(
  rows: T[],
  baselineDamage: number,
): ConfigRankRow<T>[] {
  const sorted = [...rows].sort((a, b) => b.damage - a.damage);
  const best = sorted[0]?.damage ?? 0;
  const baseline = Number.isFinite(baselineDamage) && baselineDamage > 0 ? baselineDamage : best;
  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    ratioOfBest: best > 0 ? row.damage / best : 0,
    ratioOfBaseline: baseline > 0 ? row.damage / baseline : 0,
  }));
}
