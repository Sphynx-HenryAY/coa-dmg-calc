import { useMemo } from "react";
import type {
  CircuitElement,
  CombatStats,
  ProfessionDef,
  Profile,
} from "../lib/types";
import {
  PERCENT_STATS,
  TRAINING_DUMMY_DEF,
  bagToStatBonuses,
  formatDamage,
  formatRatio,
  formatSignedStatValue,
  formatStatValue,
  makeId,
  mergeStatBags,
} from "../lib/damage";
import { STAT_LABELS } from "../lib/damage";
import { configCompareDamage, parseObservedDamage } from "../lib/compare";
import {
  findProfession,
  listProfessions,
  resolveProfession,
  resolvedCycleMultiplier,
} from "../lib/profession";
import {
  contributionLines,
  equippedCount,
  schemeContribution,
} from "../lib/circuit";
import {
  compareSchemeInsignias,
  contributionLines as insigniaContributionLines,
  defaultInsigniaName,
  equippedCount as insigniaEquippedCount,
  schemeContribution as insigniaSchemeContribution,
} from "../lib/insignia";
import {
  equippedCount as deckEquippedCount,
  schemeContribution as deckSchemeContribution,
} from "../lib/deck";
import {
  circuitElementLabel,
  insigniaRarityLabel,
  professionNameLabel,
  slotLabel,
  statLabel,
} from "../lib/i18n";
import { ProfileSchemeShareBox } from "./SchemeShareBox";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

const BASE_FIELDS: Array<{ key: keyof CombatStats; step?: string }> = [
  { key: "attack" },
  { key: "defenseBreak" },
  { key: "critRate", step: "0.1" },
  { key: "critDamage", step: "0.1" },
  { key: "elementalPower", step: "0.1" },
  { key: "skillDamage", step: "0.1" },
  { key: "resonance", step: "0.1" },
  { key: "damageBoost", step: "0.1" },
  { key: "circuitBoost", step: "0.1" },
  { key: "petDamage", step: "0.1" },
  { key: "allElementDamage", step: "0.1" },
  { key: "additionalDamage", step: "0.1" },
  { key: "statusDamage", step: "0.1" },
  { key: "bossDamage", step: "0.1" },
  { key: "penetration", step: "0.1" },
  { key: "trainingCorrection", step: "0.1" },
  { key: "skillMultiplier", step: "0.01" },
];

/** Stats that schemes can add but are not in the editable base form. */
const SCHEME_EXTRA_FIELDS: Array<keyof CombatStats> = [
  "physicalAttack",
  "magicAttack",
  "attackPercent",
  "normalAttackDamage",
];

/** Display value for base-stat inputs (percent stats as 0–100 scale). */
function baseStatInputValue(key: keyof CombatStats, stored: number): number {
  if (!Number.isFinite(stored)) return 0;
  if (PERCENT_STATS.has(key)) {
    return Math.round(stored * 10000) / 100;
  }
  return stored;
}

export function ProfilesTab() {
  const { locale, m } = useI18n();
  const {
    profiles,
    customProfessions,
    professionOverrides,
    circuitSchemes,
    insigniaSchemes,
    circuits,
    insignias,
    circuitsById,
    schemesById,
    insigniasById,
    insigniaSchemesById,
    allEquipment,
    allItems,
    activeProfile,
    activeProfileId,
    setActiveProfileId,
    monsterDef,
    setMonsterDef,
    compareIds,
    setProfiles,
    setStatus,
    profileResult,
    updateProfile,
    applyProfessionToActive,
    toggleCompare,
    shareActiveProfile,
    shareActiveProfileStats,
    shareSelectedProfiles,
    shareSelectedProfilesStats,
    exportActiveProfileCircuitScheme,
    exportActiveProfileInsigniaScheme,
    exportActiveProfileDeckScheme,
    importSchemeOntoActiveProfile,
    deckSchemes,
    deckSchemesById,
    decksById,
    editorPanelRef,
  } = useAppStore();

  const activeResult = activeProfile ? profileResult(activeProfile) : null;
  const statsWithoutSchemes = activeProfile
    ? profileResult(activeProfile, null, null).effectiveStats
    : null;
  const activeCircuitScheme = activeProfile?.circuitSchemeId
    ? schemesById.get(activeProfile.circuitSchemeId)
    : undefined;
  const activeCircuitContrib = activeCircuitScheme
    ? schemeContribution(
        activeCircuitScheme,
        circuitsById,
        activeProfile?.element ?? "all",
        activeProfile?.damageType ?? "magic",
      )
    : null;
  const activeCircuitLines = activeCircuitContrib
    ? contributionLines(activeCircuitContrib)
    : null;
  const activeInsigniaScheme = activeProfile?.insigniaSchemeId
    ? insigniaSchemesById.get(activeProfile.insigniaSchemeId)
    : undefined;
  const activeInsigniaContrib = activeInsigniaScheme
    ? insigniaSchemeContribution(
        activeInsigniaScheme,
        insigniasById,
        activeProfile?.element ?? "all",
      )
    : null;
  const activeInsigniaLines = activeInsigniaContrib
    ? insigniaContributionLines(activeInsigniaContrib)
    : null;
  const activeDeckScheme = activeProfile?.deckSchemeId
    ? deckSchemesById.get(activeProfile.deckSchemeId)
    : undefined;
  const activeDeckContrib = activeDeckScheme
    ? deckSchemeContribution(
        activeDeckScheme,
        decksById,
        activeProfile?.element ?? "all",
      )
    : null;
  const activeSchemeBonuses = bagToStatBonuses(
    mergeStatBags([
      ...(activeCircuitContrib ? [activeCircuitContrib.bag] : []),
      ...(activeInsigniaContrib ? [activeInsigniaContrib.bag] : []),
      ...(activeDeckContrib ? [activeDeckContrib.bag] : []),
    ]),
    activeProfile?.damageType ?? "magic",
  );
  const activeInsigniaComparison = useMemo(() => {
    if (!activeProfile || !activeInsigniaScheme) return null;
    return compareSchemeInsignias(
      activeInsigniaScheme,
      insignias,
      insigniasById,
      (scheme) => profileResult(activeProfile, undefined, scheme).finalDamage,
    );
    // profileResult is recreated each render; depend on its inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeProfile,
    activeInsigniaScheme,
    insignias,
    insigniasById,
    circuits,
    circuitSchemes,
    allEquipment,
    allItems,
    professionOverrides,
    customProfessions,
  ]);

  const activeProfession = activeProfile
    ? resolveProfession(
        activeProfile.professionId,
        professionOverrides,
        customProfessions,
      )
    : null;
  const activeCycle = activeProfession
    ? resolvedCycleMultiplier(
        activeProfession.cycleMultiplier,
        activeProfession.skills,
      )
    : 1;

  const slotsInUse = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEquipment) set.add(e.slot);
    return [...set];
  }, [allEquipment]);

  function monsterDefs() {
    return [
      { label: m.monsterTraining(TRAINING_DUMMY_DEF), value: TRAINING_DUMMY_DEF },
      { label: m.monsterLow, value: 5000 },
      { label: m.monsterMid, value: 20000 },
      { label: m.monsterHigh, value: 60000 },
    ];
  }

  function scrollEditorIntoViewIfNarrow(): void {
    requestAnimationFrame(() => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 960px)").matches
      ) {
        editorPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  function updateBaseStat(key: keyof CombatStats, raw: string): void {
    if (!activeProfile) return;
    let value = Number(raw);
    if (!Number.isFinite(value)) return;
    if (PERCENT_STATS.has(key)) value = value / 100;
    updateProfile(activeProfile.id, {
      base: { ...activeProfile.base, [key]: value },
    });
  }

  function equipSlot(slot: string, equipmentId: string | null): void {
    if (!activeProfile) return;
    updateProfile(activeProfile.id, {
      equipped: { ...activeProfile.equipped, [slot]: equipmentId },
    });
  }

  function toggleItem(itemId: string): void {
    if (!activeProfile) return;
    const has = activeProfile.itemIds.includes(itemId);
    updateProfile(activeProfile.id, {
      itemIds: has
        ? activeProfile.itemIds.filter((id) => id !== itemId)
        : [...activeProfile.itemIds, itemId],
    });
  }

  function chooseProfileProfession(raw: string): void {
    if (!activeProfile) return;
    if (!raw) {
      updateProfile(activeProfile.id, { professionId: null });
      return;
    }
    const profession = resolveProfession(
      raw as ProfessionDef["id"],
      professionOverrides,
      customProfessions,
    );
    if (!profession) return;
    applyProfessionToActive(profession);
  }

  function selectProfile(id: string): void {
    setActiveProfileId(id);
    scrollEditorIntoViewIfNarrow();
  }

  function duplicateProfile(profile: Profile): void {
    const copy: Profile = {
      ...structuredClone(profile),
      id: makeId("profile"),
      name: `${profile.name}${m.copiedSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProfiles((list) => [copy, ...list]);
    setActiveProfileId(copy.id);
    setStatus(m.copiedProfile);
    scrollEditorIntoViewIfNarrow();
  }

  function deleteProfile(id: string): void {
    setProfiles((list) => list.filter((p) => p.id !== id));
    setActiveProfileId(
      profiles.find((p) => p.id !== id)?.id ?? null,
    );
    setStatus(m.deletedProfile);
  }

  return (
    <div className="layout-2">
      <section className="panel">
        <div className="panel-heading">
          <h2>{m.profileList}</h2>
          {compareIds.length > 0 ? (
            <div className="panel-heading-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void shareSelectedProfiles()}
                title={m.shareSelectedFullTitle}
              >
                {m.shareSelectedFull(compareIds.length)}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void shareSelectedProfilesStats()}
                title={m.shareSelectedStatsTitle}
              >
                {m.shareSelectedStats(compareIds.length)}
              </button>
            </div>
          ) : null}
        </div>
        <p className="muted small">{m.shareMultiHint}</p>
        <div className="profile-list">
          {profiles.length === 0 ? (
            <p className="muted">{m.noProfiles}</p>
          ) : (
            profiles.map((p) => {
              const res = profileResult(p);
              const selected = p.id === activeProfileId;
              const inCompare = compareIds.includes(p.id);
              return (
                <article
                  key={p.id}
                  className={`profile-card ${selected ? "active" : ""}`}
                >
                  <div className="profile-card-head">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => selectProfile(p.id)}
                    >
                      <h3>{p.name}</h3>
                    </button>
                    <label className="check-inline profile-compare">
                      <input
                        type="checkbox"
                        checked={inCompare}
                        onChange={() => toggleCompare(p.id)}
                        aria-label={m.compareSelectAria(p.name)}
                      />
                      <span className="check-label-full">{m.compareSelect}</span>
                    </label>
                  </div>
                  <p className="muted small profile-card-note">
                    {p.professionId
                      ? professionNameLabel(
                          p.professionId,
                          locale,
                          findProfession(p.professionId, customProfessions)
                            ?.name,
                        )
                      : m.noProfessionShort}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                  <div className="profile-card-meta">
                    <div className="dmg-chip">
                      <span className="dmg-chip-label">
                        {configCompareDamage(
                          p.observedTrainingDamage,
                          res.trainingDamage,
                        ).source === "observed"
                          ? m.observedTag
                          : m.trainingDummy}{" "}
                      </span>
                      <strong>
                        {formatDamage(
                          configCompareDamage(
                            p.observedTrainingDamage,
                            res.trainingDamage,
                          ).value,
                        )}
                      </strong>
                    </div>
                    <div className="card-actions profile-card-actions">
                      <button
                        type="button"
                        onClick={() => selectProfile(p.id)}
                        aria-label={m.editAria(p.name)}
                        title={m.edit}
                      >
                        <span className="action-text">{m.edit}</span>
                        <span className="action-icon" aria-hidden="true">
                          ✎
                        </span>
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => duplicateProfile(p)}
                        aria-label={m.copyAria(p.name)}
                        title={m.copy}
                      >
                        <span className="action-text">{m.copy}</span>
                        <span className="action-icon" aria-hidden="true">
                          ⧉
                        </span>
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteProfile(p.id)}
                        aria-label={m.deleteAria(p.name)}
                        title={m.delete}
                      >
                        <span className="action-text">{m.delete}</span>
                        <span className="action-icon" aria-hidden="true">
                          ⌫
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="panel" ref={editorPanelRef} id="profile-editor">
        {activeProfile && activeResult ? (
          <>
            <div className="panel-heading">
              <h2>{m.editing(activeProfile.name)}</h2>
              <div className="panel-heading-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void shareActiveProfile()}
                  title={m.shareFullTitle}
                >
                  {m.shareFull}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void shareActiveProfileStats()}
                  title={m.shareStatsTitle}
                >
                  {m.shareStats}
                </button>
              </div>
            </div>
            <div className="form-grid">
              <label>
                {m.name}
                <input
                  value={activeProfile.name}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, { name: e.target.value })
                  }
                />
              </label>
              <label>
                {m.note}
                <input
                  value={activeProfile.note}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, { note: e.target.value })
                  }
                />
              </label>
              <label>
                {m.observedTraining}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder={m.observedTrainingPh}
                  value={
                    activeProfile.observedTrainingDamage != null
                      ? activeProfile.observedTrainingDamage
                      : ""
                  }
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      observedTrainingDamage: parseObservedDamage(e.target.value),
                    })
                  }
                />
                <span className="stat-scheme-bonus">
                  {activeProfile.observedTrainingDamage
                    ? m.observedTag
                    : m.noObserved}
                </span>
              </label>
              <label>
                {m.profession}
                <select
                  value={activeProfile.professionId ?? ""}
                  onChange={(e) => chooseProfileProfession(e.target.value)}
                >
                  <option value="">{m.noProfessionOption}</option>
                  {listProfessions(customProfessions).map((p) => (
                    <option key={p.id} value={p.id}>
                      {professionNameLabel(p.id, locale, p.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {m.damageType}
                <select
                  value={activeProfile.damageType}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      damageType: e.target.value as Profile["damageType"],
                    })
                  }
                >
                  <option value="magic">{m.magic}</option>
                  <option value="physical">{m.physical}</option>
                </select>
              </label>
              <label>
                {m.skillElement}
                <select
                  value={activeProfile.element ?? "all"}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      element: e.target.value as CircuitElement | "all",
                    })
                  }
                >
                  <option value="all">{m.elementAll}</option>
                  <option value="ice">{circuitElementLabel("ice")}</option>
                  <option value="fire">{circuitElementLabel("fire")}</option>
                  <option value="electric">
                    {circuitElementLabel("electric")}
                  </option>
                  <option value="dark">{circuitElementLabel("dark")}</option>
                </select>
              </label>
              <label>
                {m.circuitScheme}
                <select
                  value={activeProfile.circuitSchemeId ?? ""}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      circuitSchemeId: e.target.value || null,
                    })
                  }
                >
                  <option value="">{m.noCircuitScheme}</option>
                  {circuitSchemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {m.schemeCount(s.name, equippedCount(s))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {m.insigniaScheme}
                <select
                  value={activeProfile.insigniaSchemeId ?? ""}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      insigniaSchemeId: e.target.value || null,
                    })
                  }
                >
                  <option value="">{m.noInsigniaScheme}</option>
                  {insigniaSchemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {m.schemeCount(s.name, insigniaEquippedCount(s))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {m.deckScheme}
                <select
                  value={activeProfile.deckSchemeId ?? ""}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      deckSchemeId: e.target.value || null,
                    })
                  }
                >
                  <option value="">{m.noDeckScheme}</option>
                  {deckSchemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {m.schemeCount(s.name, deckEquippedCount(s))}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ProfileSchemeShareBox
              canExportCircuit={!!activeProfile.circuitSchemeId}
              canExportInsignia={!!activeProfile.insigniaSchemeId}
              onExportCircuit={exportActiveProfileCircuitScheme}
              onExportInsignia={exportActiveProfileInsigniaScheme}
              canExportDeck={!!activeProfile.deckSchemeId}
              onExportDeck={exportActiveProfileDeckScheme}
              onImport={importSchemeOntoActiveProfile}
              onStatus={setStatus}
            />

            <h3 className="section-title">{m.baseStats}</h3>
            <p className="muted small">{m.baseStatsHint}</p>
            <div className="stats-grid">
              {BASE_FIELDS.map(({ key, step }) => {
                const isPercent = PERCENT_STATS.has(key);
                const stored = Number(activeProfile.base[key] ?? 0);
                const bonus = activeSchemeBonuses[key] ?? 0;
                return (
                  <label key={key}>
                    {statLabel(key)}
                    {isPercent ? " (%)" : ""}
                    <div className={isPercent ? "input-with-suffix" : undefined}>
                      <input
                        type="number"
                        step={step ?? "1"}
                        value={baseStatInputValue(key, stored)}
                        onChange={(e) => updateBaseStat(key, e.target.value)}
                      />
                      {isPercent ? <span className="input-suffix">%</span> : null}
                    </div>
                    {bonus ? (
                      <span className="stat-scheme-bonus">
                        {m.schemeBonus(formatSignedStatValue(key, bonus))}
                      </span>
                    ) : null}
                    {key === "skillMultiplier" && activeProfession ? (
                      <span className="stat-scheme-bonus">
                        {m.cycleOnMultiplier(
                          professionNameLabel(
                            activeProfession.id,
                            locale,
                            activeProfession.name,
                          ),
                          activeCycle.toFixed(3),
                          (
                            (Number.isFinite(stored) && stored !== 0
                              ? stored
                              : 1) * activeCycle
                          ).toFixed(3),
                        )}
                      </span>
                    ) : null}
                  </label>
                );
              })}
              {SCHEME_EXTRA_FIELDS.map((key) => {
                const bonus = activeSchemeBonuses[key] ?? 0;
                if (!bonus) return null;
                return (
                  <label key={key} className="stat-scheme-extra">
                    {statLabel(key)}
                    <div className="stat-scheme-total">
                      {formatSignedStatValue(key, bonus)}
                    </div>
                    <span className="stat-scheme-bonus">{m.schemeProvided}</span>
                  </label>
                );
              })}
            </div>

            <h3 className="section-title">{m.equipSlots}</h3>
            <div className="equip-grid">
              {slotsInUse.map((slot) => {
                const options = allEquipment.filter((e) => e.slot === slot);
                if (options.length === 0) return null;
                const current = activeProfile.equipped[slot] ?? "";
                return (
                  <label key={slot}>
                    {slotLabel(slot)}
                    <select
                      value={current}
                      onChange={(e) =>
                        equipSlot(slot, e.target.value || null)
                      }
                    >
                      <option value="">{m.unequipped}</option>
                      {options.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                          {e.demo ? "" : " ★"}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            <h3 className="section-title">{m.circuitSocket}</h3>
            {activeCircuitScheme && activeCircuitLines ? (
              <div className="circuit-profile-summary">
                <p className="muted small">
                  {m.currentScheme(
                    activeCircuitScheme.name,
                    equippedCount(activeCircuitScheme),
                  )}
                </p>
                {activeCircuitLines.damage.length > 0 ? (
                  <ul className="stat-lines">
                    {activeCircuitLines.damage.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{m.schemeNoDamage}</p>
                )}
              </div>
            ) : (
              <p className="muted small">
                {m.noCircuitApplied}
              </p>
            )}

            <h3 className="section-title">{m.insigniaSocket}</h3>
            {activeInsigniaScheme && activeInsigniaLines ? (
              <div className="circuit-profile-summary">
                <p className="muted small">
                  {m.currentScheme(
                    activeInsigniaScheme.name,
                    insigniaEquippedCount(activeInsigniaScheme),
                  )}
                </p>
                {activeInsigniaLines.damage.length > 0 ? (
                  <ul className="stat-lines">
                    {activeInsigniaLines.damage.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{m.schemeNoDamage}</p>
                )}
                {activeInsigniaComparison &&
                activeInsigniaComparison.equipped.length > 0 ? (
                  <InsigniaProfileGains comparison={activeInsigniaComparison} />
                ) : null}
              </div>
            ) : (
              <p className="muted small">
                {m.noInsigniaApplied}
              </p>
            )}

            <h3 className="section-title">{m.itemsBuffs}</h3>
            <div className="item-toggle-grid">
              {allItems.map((item) => {
                const on = activeProfile.itemIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`item-toggle ${on ? "on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.statLines.join(" · ")}</small>
                    </span>
                  </label>
                );
              })}
            </div>

            <h3 className="section-title">{m.calcResult}</h3>
            <div className="result-panel">
              <div className="result-main">
                <div>
                  <span className="muted">{m.trainingDamage}</span>
                  <div className="result-dmg">
                    {formatDamage(
                      configCompareDamage(
                        activeProfile.observedTrainingDamage,
                        activeResult.trainingDamage,
                      ).value,
                    )}
                  </div>
                  <span className="muted small">
                    {configCompareDamage(
                      activeProfile.observedTrainingDamage,
                      activeResult.trainingDamage,
                    ).source === "observed"
                      ? `${m.observedTag} · ${m.formulaTag} ${formatDamage(activeResult.trainingDamage)}`
                      : m.trainingNoBoss(TRAINING_DUMMY_DEF)}
                    {activeProfession
                      ? ` · ${m.cycleOn(professionNameLabel(activeProfession.id, locale, activeProfession.name), activeCycle.toFixed(3))}`
                      : ""}
                  </span>
                </div>
                <div>
                  <span className="muted">{m.finalDamageBoss}</span>
                  <div className="result-sub">
                    {formatDamage(activeResult.finalDamage)}
                  </div>
                </div>
                <label>
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
                <div>
                  <span className="muted">{m.vsMonster}</span>
                  <div className="result-sub">
                    {formatDamage(activeResult.vsMonster(monsterDef))}
                  </div>
                </div>
              </div>

              <h4>{m.effectiveStats}</h4>
              <dl className="stat-list">
                {(Object.keys(STAT_LABELS) as Array<keyof CombatStats>).map(
                  (key) => {
                    const value = Number(activeResult.effectiveStats[key] ?? 0);
                    const without = Number(statsWithoutSchemes?.[key] ?? 0);
                    const delta = value - without;
                    if (key === "attackPercent" || key === "normalAttackDamage") {
                      if (!value && !delta) return null;
                    }
                    return (
                      <div key={key}>
                        <dt>{statLabel(key)}</dt>
                        <dd>
                          {formatStatValue(key, value)}
                          {delta ? (
                            <small className="stat-scheme-bonus">
                              {m.schemeBonus(formatSignedStatValue(key, delta))}
                            </small>
                          ) : null}
                        </dd>
                      </div>
                    );
                  },
                )}
              </dl>

              <h4>{m.formulaZones}</h4>
              <dl className="stat-list compact">
                {Object.entries(activeResult.factors).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{Number(v).toFixed(4)}</dd>
                  </div>
                ))}
              </dl>
              <p className="formula-note">{m.formulaNote}</p>
            </div>
          </>
        ) : (
          <p className="muted">{m.pickProfile}</p>
        )}
      </section>
    </div>
  );
}

function InsigniaProfileGains({
  comparison,
}: {
  comparison: NonNullable<ReturnType<typeof compareSchemeInsignias>>;
}) {
  const { m } = useI18n();
  const maxAbs = Math.max(
    0,
    ...comparison.equipped.map((row) => Math.abs(row.delta)),
  );
  return (
    <div className="circuit-gain-list" style={{ marginTop: 12 }}>
      <p className="muted small">{m.insigniaMarginalHint}</p>
      {comparison.equipped.map((row) => {
        const width = maxAbs > 0 ? (Math.abs(row.delta) / maxAbs) * 100 : 0;
        const sign = row.delta > 0 ? "+" : row.delta < 0 ? "−" : "";
        const ratioSign = row.ratio > 0 ? "+" : row.ratio < 0 ? "−" : "";
        return (
          <div key={`${row.slot}-${row.piece.id}`} className="circuit-gain-row">
            <div className="circuit-gain-meta">
              <span className="circuit-gain-slot">{slotLabel(row.slot)}</span>
              <span className={`kind-pill ${row.piece.rarity}`}>
                {insigniaRarityLabel(row.piece.rarity)}
              </span>
              <span className="circuit-gain-name">
                {row.piece.name || defaultInsigniaName(row.piece)}
              </span>
            </div>
            <div className="circuit-gain-bar-track">
              <div
                className={`circuit-gain-bar kind-${row.piece.rarity} ${
                  row.delta < 0 ? "neg" : ""
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            <div
              className={`circuit-gain-nums ${
                row.delta > 0
                  ? "gain-pos"
                  : row.delta < 0
                    ? "gain-neg"
                    : "gain-zero"
              }`}
            >
              <span>
                {sign}
                {formatDamage(Math.abs(row.delta))}
              </span>
              <span>
                {ratioSign}
                {formatRatio(Math.abs(row.ratio))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
