import { useMemo } from "react";
import type {
  Profile,
} from "../lib/types";
import {
  STAT_LABELS,
  TRAINING_DUMMY_DEF,
  formatDamage,
  formatRatio,
  formatStatValue,
} from "../lib/damage";
import { configCompareDamage, rankConfigDamage } from "../lib/compare";
import { findProfession } from "../lib/profession";
import { professionNameLabel, statLabel } from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

export function CompareTab() {
  const { locale, m } = useI18n();
  const {
    profiles,
    compareIds,
    monsterDef,
    setMonsterDef,
    customProfessions,
    schemesById,
    insigniaSchemesById,
    activeProfile,
    profileResult,
    toggleCompare,
    moveCompare,
    setCompareBaseline,
  } = useAppStore();

  const activeResult = activeProfile ? profileResult(activeProfile) : null;

  const compareProfiles = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return compareIds
      .map((id) => byId.get(id))
      .filter((p): p is Profile => p !== undefined);
  }, [profiles, compareIds]);

  const compareResults = useMemo(
    () =>
      compareProfiles.map((p) => ({
        profile: p,
        result: profileResult(p),
      })),
    [compareProfiles, profileResult],
  );

  const baselineDamage =
    compareResults[0]?.result.finalDamage ?? activeResult?.finalDamage ?? 1;

  const compareRanked = useMemo(() => {
    const rows = compareResults.map(({ profile, result }) => {
      const bound = configCompareDamage(
        profile.observedTrainingDamage,
        result.trainingDamage,
      );
      return {
        profile,
        formulaTraining: result.trainingDamage,
        damage: bound.value,
        source: bound.source,
      };
    });
    const baselineId = compareResults[0]?.profile.id;
    const baseline =
      rows.find((row) => row.profile.id === baselineId)?.damage ??
      rows[0]?.damage ??
      0;
    return rankConfigDamage(rows, baseline);
  }, [compareResults]);

  const baselineTraining =
    compareRanked.find((row) => row.profile.id === compareResults[0]?.profile.id)
      ?.damage ??
    compareResults[0]?.result.trainingDamage ??
    activeResult?.trainingDamage ??
    1;

  function monsterDefs() {
    return [
      { label: m.monsterTraining(TRAINING_DUMMY_DEF), value: TRAINING_DUMMY_DEF },
      { label: m.monsterLow, value: 5000 },
      { label: m.monsterMid, value: 20000 },
      { label: m.monsterHigh, value: 60000 },
    ];
  }

  return (
    <section className="panel wide">
      <h2>{m.compareTitle}</h2>
      <p className="muted">{m.compareHint}</p>
      <div className="filter-row">
        <label className="inline-label">
          {m.monsterDef}
          <select
            value={monsterDef}
            onChange={(e) => setMonsterDef(Number(e.target.value))}
          >
            {monsterDefs().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {compareProfiles.length > 0 ? (
        <div className="compare-order">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            {m.compareOrder}
          </h3>
          <ol className="compare-order-list">
            {compareProfiles.map((p, index) => (
              <li key={p.id} className="compare-order-item">
                <span className="compare-order-rank">
                  {index === 0 ? m.baseline : index + 1}
                </span>
                <span className="compare-order-name">{p.name}</span>
                <span className="muted small">
                  {formatDamage(
                    configCompareDamage(
                      p.observedTrainingDamage,
                      profileResult(p).trainingDamage,
                    ).value,
                  )}{" "}
                  {configCompareDamage(
                    p.observedTrainingDamage,
                    profileResult(p).trainingDamage,
                  ).source === "observed"
                    ? m.observedTag
                    : m.trainingChip}
                </span>
                <div className="compare-order-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === 0}
                    onClick={() => moveCompare(p.id, -1)}
                    title={m.moveUp}
                    aria-label={m.moveUpAria(p.name)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === compareProfiles.length - 1}
                    onClick={() => moveCompare(p.id, 1)}
                    title={m.moveDown}
                    aria-label={m.moveDownAria(p.name)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === 0}
                    onClick={() => setCompareBaseline(p.id)}
                    title={m.setBaselineTitle}
                  >
                    {m.setBaseline}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {compareRanked.length < 2 ? (
        <p className="muted">{m.needTwoProfiles}</p>
      ) : (
        <div className="compare-ratio">
          <h3 className="section-title">{m.damageRatioTitle}</h3>
          <p className="muted small">{m.boundDamageHint}</p>
          <div className="compare-table-wrap">
            <table className="compare-table profession-rank-table">
              <thead>
                <tr>
                  <th>{m.colRank}</th>
                  <th>{m.name}</th>
                  <th>{m.colBoundDmg}</th>
                  <th>{m.ratioOfBaseline}</th>
                  <th>{m.ratioOfBest}</th>
                </tr>
              </thead>
              <tbody>
                {compareRanked.map((row) => (
                  <tr
                    key={row.profile.id}
                    className={
                      row.profile.id === compareResults[0]?.profile.id
                        ? "profession-row-active"
                        : ""
                    }
                  >
                    <td className="num">{row.rank}</td>
                    <td>
                      <strong>{row.profile.name}</strong>
                      <div className="muted small">
                        {row.profile.professionId
                          ? professionNameLabel(
                              row.profile.professionId,
                              locale,
                              findProfession(
                                row.profile.professionId,
                                customProfessions,
                              )?.name,
                            )
                          : m.noProfessionShort}
                        {" · "}
                        {row.source === "observed"
                          ? m.observedTag
                          : m.formulaTag}
                      </div>
                    </td>
                    <td className="num">
                      <strong>{formatDamage(row.damage)}</strong>
                      {row.source === "observed" ? (
                        <div className="muted small">
                          {m.formulaTag}{" "}
                          {formatDamage(row.formulaTraining)}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">
                      {row.ratioOfBaseline.toFixed(3)}×
                    </td>
                    <td>
                      <div className="profession-bar-track">
                        <span
                          className="profession-bar"
                          style={{
                            width: `${Math.max(row.ratioOfBest * 100, 2)}%`,
                          }}
                        />
                      </div>
                      <div className="num muted small">
                        {formatRatio(row.ratioOfBest)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {compareResults.length < 2 ? null : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>{m.compareItem}</th>
                {compareResults.map(({ profile }, index) => (
                  <th key={profile.id}>
                    <div className="compare-th">
                      <span>
                        {index === 0 ? (
                          <span className="baseline-tag">{m.baselineTag}</span>
                        ) : null}
                        {profile.name}
                      </span>
                      <span className="compare-th-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={index === 0}
                          onClick={() => moveCompare(profile.id, -1)}
                          title={m.moveLeft}
                          aria-label={m.moveLeftAria(profile.name)}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={index === compareResults.length - 1}
                          onClick={() => moveCompare(profile.id, 1)}
                          title={m.moveRight}
                          aria-label={m.moveRightAria(profile.name)}
                        >
                          →
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{m.circuitScheme}</td>
                {compareResults.map(({ profile }) => {
                  const scheme = profile.circuitSchemeId
                    ? schemesById.get(profile.circuitSchemeId)
                    : undefined;
                  return (
                    <td key={profile.id}>
                      {scheme ? scheme.name : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td>{m.insigniaScheme}</td>
                {compareResults.map(({ profile }) => {
                  const scheme = profile.insigniaSchemeId
                    ? insigniaSchemesById.get(profile.insigniaSchemeId)
                    : undefined;
                  return (
                    <td key={profile.id}>
                      {scheme ? scheme.name : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td>{m.profession}</td>
                {compareResults.map(({ profile }) => (
                  <td key={profile.id}>
                    {profile.professionId
                      ? professionNameLabel(
                          profile.professionId,
                          locale,
                          findProfession(
                            profile.professionId,
                            customProfessions,
                          )?.name,
                        )
                      : m.noProfessionShort}
                  </td>
                ))}
              </tr>
              <tr>
                <td>{m.boundDamage}</td>
                {compareResults.map(({ profile, result }) => {
                  const bound = configCompareDamage(
                    profile.observedTrainingDamage,
                    result.trainingDamage,
                  );
                  return (
                    <td key={profile.id} className="num">
                      {formatDamage(bound.value)}
                      <div className="muted small">
                        {bound.source === "observed"
                          ? m.observedTag
                          : m.formulaTag}
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td>{m.trainingDamage}</td>
                {compareResults.map(({ profile, result }) => (
                  <td key={profile.id} className="num">
                    {formatDamage(result.trainingDamage)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>{m.trainingCompare}</td>
                {compareResults.map(({ profile, result }) => {
                  const bound = configCompareDamage(
                    profile.observedTrainingDamage,
                    result.trainingDamage,
                  );
                  return (
                    <td key={profile.id} className="num">
                      {(bound.value / Math.max(baselineTraining, 1e-9)).toFixed(4)}×
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td>{m.finalDamage}</td>
                {compareResults.map(({ profile, result }) => (
                  <td key={profile.id} className="num">
                    {formatDamage(result.finalDamage)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>{m.dmgVsBaseline}</td>
                {compareResults.map(({ profile, result }) => (
                  <td key={profile.id} className="num">
                    {(result.finalDamage / baselineDamage).toFixed(4)}×
                  </td>
                ))}
              </tr>
              <tr>
                <td>{m.upliftVsThis}</td>
                {compareResults.map(({ profile, result }) => {
                  const uplift =
                    (baselineDamage - result.finalDamage) /
                    Math.max(result.finalDamage, 1e-9);
                  return (
                    <td key={profile.id} className="num">
                      {formatRatio(uplift)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td>{m.vsMonster}</td>
                {compareResults.map(({ profile, result }) => (
                  <td key={profile.id} className="num">
                    {formatDamage(result.vsMonster(monsterDef))}
                  </td>
                ))}
              </tr>
              {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>)
                .filter((k) => k !== "attackPercent")
                .map((key) => (
                  <tr key={key}>
                    <td>{statLabel(key)}</td>
                    {compareResults.map(({ profile, result }) => (
                      <td key={profile.id} className="num">
                        {formatStatValue(
                          key,
                          Number(result.effectiveStats[key] ?? 0),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="compare-picks">
        <h3>{m.quickPick}</h3>
        <div className="item-toggle-grid">
          {profiles.map((p) => (
            <label
              key={p.id}
              className={`item-toggle ${compareIds.includes(p.id) ? "on" : ""}`}
            >
              <input
                type="checkbox"
                checked={compareIds.includes(p.id)}
                onChange={() => toggleCompare(p.id)}
              />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {formatDamage(
                    configCompareDamage(
                      p.observedTrainingDamage,
                      profileResult(p).trainingDamage,
                    ).value,
                  )}{" "}
                  {configCompareDamage(
                    p.observedTrainingDamage,
                    profileResult(p).trainingDamage,
                  ).source === "observed"
                    ? m.observedTag
                    : m.trainingChip}
                </small>
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
