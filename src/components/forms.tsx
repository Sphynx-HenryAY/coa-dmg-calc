import React from "react";
import { useI18n } from "../lib/I18nProvider";
import { parseStatInput, statInputValue } from "../lib/statInput";
import {
  formatSignedDamage,
  formatSignedRatio,
  gainClass,
  slotHint,
} from "../lib/format";

export { formatSignedDamage, formatSignedRatio, gainClass, slotHint };

export type AffixDraft<K extends string> = { stat: K | ""; value: number };

export interface AffixRowListProps<K extends string> {
  label?: string;
  rows: AffixDraft<K>[];
  options: K[];
  percentSet: Set<K>;
  labelFor: (stat: K) => string;
  /** Optional per-stat suffix rendered inside each option (e.g. " · elem. points"). */
  suffixFor?: (stat: K) => string;
  /** Override the row header text; defaults to `${label} ${index + 1}`. */
  rowHeader?: (index: number) => string;
  used?: Set<K>;
  allowDuplicates?: boolean;
  onChange: React.Dispatch<React.SetStateAction<AffixDraft<K>[]>>;
}

export function AffixRowList<K extends string>({
  label,
  rows,
  options,
  percentSet,
  labelFor,
  suffixFor,
  rowHeader,
  used,
  allowDuplicates = false,
  onChange,
}: AffixRowListProps<K>) {
  const { m } = useI18n();
  return (
    <div className="circuit-subs">
      {rows.map((row, index) => (
        <div key={index} className="circuit-sub-row">
          <label>
            {rowHeader ? rowHeader(index) : `${label ?? ""} ${index + 1}`}
            <select
              value={row.stat}
              onChange={(e) => {
                const nextStat = e.target.value as K | "";
                onChange((list) => {
                  const next = [...list];
                  next[index] = { stat: nextStat, value: 0 };
                  return next;
                });
              }}
            >
              <option value="">{m.unused}</option>
              {options.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={!allowDuplicates && !!used?.has(s) && row.stat !== s}
                >
                  {labelFor(s)}
                  {percentSet.has(s) ? " (%)" : ""}
                  {suffixFor ? suffixFor(s) : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.valueLabel}
            {row.stat !== "" && percentSet.has(row.stat) ? " (%)" : ""}
            <div
              className={
                row.stat !== "" && percentSet.has(row.stat)
                  ? "input-with-suffix"
                  : undefined
              }
            >
              <input
                type="number"
                step={row.stat !== "" && percentSet.has(row.stat) ? "0.1" : "1"}
                disabled={!row.stat}
                value={row.stat !== "" ? statInputValue(row.stat, row.value, percentSet) : 0}
                onChange={(e) => {
                  if (!row.stat) return;
                  const parsed = parseStatInput(row.stat, e.target.value, percentSet);
                  onChange((list) => {
                    const next = [...list];
                    next[index] = { ...next[index]!, value: parsed };
                    return next;
                  });
                }}
              />
              {row.stat !== "" && percentSet.has(row.stat) ? (
                <span className="input-suffix">%</span>
              ) : null}
            </div>
          </label>
        </div>
      ))}
    </div>
  );
}
