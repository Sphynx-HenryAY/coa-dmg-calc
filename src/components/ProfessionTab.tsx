import { useMemo, useState } from "react";
import type {
  CircuitElement,
  DamageResult,
  DamageType,
  ProfessionDef,
  ProfessionFamily,
  ProfessionId,
  ProfessionOverride,
  ProfessionSkill,
  Profile,
} from "../lib/types";
import {
  formatDamage,
  formatRatio,
  makeId,
  TRAINING_DUMMY_DEF,
} from "../lib/damage";
import {
  PROFESSION_FAMILIES,
  calibrateCycleMultiplier,
  createCustomProfession,
  cycleMultiplierFromSkills,
  isBuiltinProfessionId,
  listProfessions,
  rankProfessions,
  removeCustomProfession,
  resetProfessionOverride,
  resolveProfession,
  resolvedCycleMultiplier,
  upsertCustomProfession,
  upsertProfessionOverride,
  type ProfessionRankRow,
} from "../lib/profession";
import {
  circuitElementLabel,
  professionFamilyLabel,
  professionNameLabel,
  professionNoteLabel,
} from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";

type ProfessionTabProps = {
  activeProfile: Profile | null;
  overrides: ProfessionOverride[];
  setOverrides: React.Dispatch<React.SetStateAction<ProfessionOverride[]>>;
  customProfessions: ProfessionDef[];
  setCustomProfessions: React.Dispatch<React.SetStateAction<ProfessionDef[]>>;
  profileResult: (
    profile: Profile,
    schemeOverride?: undefined,
    insigniaOverride?: undefined,
    extraProfessionOverrides?: ProfessionOverride[],
  ) => DamageResult;
  onApplyProfession: (profession: ProfessionDef) => void;
  onDeleteCustomProfession: (id: ProfessionId) => void;
  onStatus: (msg: string) => void;
};

export function ProfessionTab({
  activeProfile,
  overrides,
  setOverrides,
  customProfessions,
  setCustomProfessions,
  profileResult,
  onApplyProfession,
  onDeleteCustomProfession,
  onStatus,
}: ProfessionTabProps) {
  const { m, locale } = useI18n();
  const catalog = listProfessions(customProfessions);
  const [selectedId, setSelectedId] = useState<ProfessionId>(
    activeProfile?.professionId ?? "elementalist",
  );
  const [useProfessionType, setUseProfessionType] = useState(true);
  const [useProfessionElement, setUseProfessionElement] = useState(true);
  const [observed, setObserved] = useState("");
  const [editingId, setEditingId] = useState<ProfessionId | null>(null);
  const [newName, setNewName] = useState("");
  const [newFamily, setNewFamily] = useState<ProfessionFamily>("sword");
  const [newType, setNewType] = useState<DamageType>("physical");
  const [newElement, setNewElement] = useState<CircuitElement | "all">("all");

  const selected = resolveProfession(selectedId, overrides, customProfessions);
  const editing = editingId
    ? resolveProfession(editingId, overrides, customProfessions)
    : null;
  const selectedIsCustom = selected ? !isBuiltinProfessionId(selected.id) : false;

  const ranked = useMemo(() => {
    if (!activeProfile) return [];
    const rows = listProfessions(customProfessions).map((catalog) => {
      const profession = resolveProfession(
        catalog.id,
        overrides,
        customProfessions,
      )!;
      const virtual: Profile = {
        ...activeProfile,
        professionId: profession.id,
        damageType: useProfessionType
          ? profession.damageType
          : activeProfile.damageType,
        element: useProfessionElement
          ? profession.defaultElement
          : (activeProfile.element ?? "all"),
      };
      const result = profileResult(virtual);
      const cycleMultiplier = resolvedCycleMultiplier(
        profession.cycleMultiplier,
        profession.skills,
      );
      return {
        profession,
        result,
        cycleMultiplier,
        damageType: virtual.damageType,
        element: virtual.element ?? "all",
        trainingDps:
          profession.cycleSeconds > 0
            ? result.trainingDamage / profession.cycleSeconds
            : result.trainingDamage,
      };
    });
    return rankProfessions(rows);
    // profileResult is recreated each render; depend on its inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeProfile,
    overrides,
    customProfessions,
    useProfessionType,
    useProfessionElement,
  ]);

  function patchSelected(patch: Partial<ProfessionOverride>): void {
    if (!selected) return;
    setOverrides((list) =>
      upsertProfessionOverride(list, { id: selected.id, ...patch }),
    );
  }

  function updateSkill(index: number, patch: Partial<ProfessionSkill>): void {
    if (!editing) return;
    const skills = editing.skills.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    setOverrides((list) => upsertProfessionOverride(list, { id: editing.id, skills }));
  }

  function addSkill(): void {
    if (!editing) return;
    const skills = [
      ...editing.skills,
      {
        id: makeId("ps"),
        name: m.newSkill,
        percent: 0,
        hits: 1,
        uses: 1,
        enabled: true,
      },
    ];
    setOverrides((list) => upsertProfessionOverride(list, { id: editing.id, skills }));
  }

  function removeSkill(index: number): void {
    if (!editing) return;
    const skills = editing.skills.filter((_, i) => i !== index);
    setOverrides((list) => upsertProfessionOverride(list, { id: editing.id, skills }));
  }

  function calibrateSelected(): void {
    if (!activeProfile || !selected) {
      onStatus(m.pickProfileAndProfession);
      return;
    }
    const observedN = Number(observed);
    if (!Number.isFinite(observedN) || observedN <= 0) {
      onStatus(m.needTrainingNumber);
      return;
    }
    const virtual: Profile = {
      ...activeProfile,
      professionId: selected.id,
      damageType: useProfessionType ? selected.damageType : activeProfile.damageType,
      element: useProfessionElement
        ? selected.defaultElement
        : (activeProfile.element ?? "all"),
    };
    const atOne = profileResult(virtual, undefined, undefined, [
      {
        id: selected.id,
        cycleMultiplier: 1,
        skills: selected.skills.map((s) => ({ ...s, percent: 0, enabled: false })),
      },
    ]);
    const cycle = calibrateCycleMultiplier(observedN, atOne.trainingDamage);
    setOverrides((list) =>
      upsertProfessionOverride(list, {
        id: selected.id,
        cycleMultiplier: Math.round(cycle * 10000) / 10000,
        skills: selected.skills.map((s) => ({ ...s, percent: 0 })),
      }),
    );
    onStatus(
      m.calibratedCycle(
        formatDamage(observedN),
        professionNameLabel(selected.id, locale, selected.name),
        cycle.toFixed(4),
      ),
    );
  }

  function resetSelected(): void {
    if (!selected) return;
    setOverrides((list) => resetProfessionOverride(list, selected.id));
    onStatus(
      m.resetProfession(professionNameLabel(selected.id, locale, selected.name)),
    );
  }

  function addProfession(): void {
    const name = newName.trim();
    if (!name) {
      onStatus(m.needProfessionName);
      return;
    }
    const created = createCustomProfession(
      {
        name,
        family: newFamily,
        damageType: newType,
        defaultElement: newElement,
      },
      customProfessions,
    );
    setCustomProfessions((list) => upsertCustomProfession(list, created));
    setSelectedId(created.id);
    setEditingId(created.id);
    setNewName("");
    onStatus(m.addedProfession(created.name));
  }

  function patchCustom(patch: Partial<ProfessionDef>): void {
    if (!selected || !selectedIsCustom) return;
    const id = selected.id;
    setCustomProfessions((list) => {
      const base = list.find((p) => p.id === id);
      if (!base) return list;
      return upsertCustomProfession(list, { ...base, ...patch, id });
    });
  }

  function deleteSelectedCustom(): void {
    if (!selected || !selectedIsCustom) return;
    if (!window.confirm(m.confirmDeleteProfession(selected.name))) return;
    const id = selected.id;
    const name = selected.name;
    setCustomProfessions((list) => removeCustomProfession(list, id));
    setOverrides((list) => resetProfessionOverride(list, id));
    onDeleteCustomProfession(id);
    setEditingId((cur) => (cur === id ? null : cur));
    setSelectedId("ghostblade");
    onStatus(m.deletedProfession(name));
  }

  return (
    <div className="layout-2">
      <section className="panel">
        <h2>{m.professionTitle}</h2>
        <p className="muted small">{m.professionHint}</p>

        <div className="form-grid">
          <label>
            {m.editProfession}
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value as ProfessionId)}
            >
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {professionFamilyLabel(p.family)} ·{" "}
                  {professionNameLabel(p.id, locale, p.name)}
                  {isBuiltinProfessionId(p.id) ? "" : ` · ${m.customProfession}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3 className="section-title">{m.addProfession}</h3>
        <p className="muted small">{m.customProfessionHint}</p>
        <div className="stats-grid">
          <label>
            {m.colName}
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={m.professionNamePh}
            />
          </label>
          <label>
            {m.professionFamily}
            <select
              value={newFamily}
              onChange={(e) =>
                setNewFamily(e.target.value as ProfessionFamily)
              }
            >
              {PROFESSION_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {professionFamilyLabel(family)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.professionDamageType}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as DamageType)}
            >
              <option value="physical">{m.physical}</option>
              <option value="magic">{m.magic}</option>
            </select>
          </label>
          <label>
            {m.professionElement}
            <select
              value={newElement}
              onChange={(e) =>
                setNewElement(e.target.value as CircuitElement | "all")
              }
            >
              <option value="all">{m.elementAll}</option>
              <option value="ice">{circuitElementLabel("ice")}</option>
              <option value="fire">{circuitElementLabel("fire")}</option>
              <option value="electric">{circuitElementLabel("electric")}</option>
              <option value="dark">{circuitElementLabel("dark")}</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={addProfession}>
            {m.addProfession}
          </button>
        </div>

        {selected ? (
          <>
            <div className="profession-meta">
              <span className={`kind-pill ${selected.family}`}>
                {professionFamilyLabel(selected.family)}
              </span>
              <span className="kind-pill rank">
                {selected.damageType === "magic" ? m.magic : m.physical}
              </span>
              <span className="kind-pill rank">
                {circuitElementLabel(selected.defaultElement)}
              </span>
              {selectedIsCustom ? (
                <span className="kind-pill custom">{m.customProfession}</span>
              ) : null}
            </div>
            {selectedIsCustom ? (
              <div className="stats-grid">
                <label>
                  {m.colName}
                  <input
                    value={selected.name}
                    onChange={(e) => patchCustom({ name: e.target.value })}
                  />
                </label>
                <label>
                  {m.professionFamily}
                  <select
                    value={selected.family}
                    onChange={(e) =>
                      patchCustom({
                        family: e.target.value as ProfessionFamily,
                      })
                    }
                  >
                    {PROFESSION_FAMILIES.map((family) => (
                      <option key={family} value={family}>
                        {professionFamilyLabel(family)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {m.professionDamageType}
                  <select
                    value={selected.damageType}
                    onChange={(e) =>
                      patchCustom({
                        damageType: e.target.value as DamageType,
                      })
                    }
                  >
                    <option value="physical">{m.physical}</option>
                    <option value="magic">{m.magic}</option>
                  </select>
                </label>
                <label>
                  {m.professionElement}
                  <select
                    value={selected.defaultElement}
                    onChange={(e) =>
                      patchCustom({
                        defaultElement: e.target.value as CircuitElement | "all",
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
                <label className="span-2">
                  {m.note}
                  <input
                    value={selected.note}
                    onChange={(e) => patchCustom({ note: e.target.value })}
                    placeholder={m.professionNotePh}
                  />
                </label>
              </div>
            ) : (
              <p className="muted small">
                {professionNoteLabel(selected.id, locale, selected.note)}
              </p>
            )}

            <div className="stats-grid">
              <label>
                {m.cycleMultiplier}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={selected.cycleMultiplier}
                  onChange={(e) =>
                    patchSelected({ cycleMultiplier: Number(e.target.value) })
                  }
                />
                <span className="stat-scheme-bonus">
                  {m.effective}{" "}
                  {resolvedCycleMultiplier(
                    selected.cycleMultiplier,
                    selected.skills,
                  ).toFixed(4)}
                  {cycleMultiplierFromSkills(selected.skills) > 0
                    ? m.fromSkillTable
                    : ""}
                </span>
              </label>
              <label>
                {m.cycleSeconds}
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={selected.cycleSeconds}
                  onChange={(e) =>
                    patchSelected({ cycleSeconds: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <h3 className="section-title">{m.calibrateTitle}</h3>
            <p className="muted small">{m.calibrateHint(TRAINING_DUMMY_DEF)}</p>
            <div className="filter-row">
              <input
                type="number"
                inputMode="decimal"
                placeholder={m.trainingDamagePh}
                value={observed}
                onChange={(e) => setObserved(e.target.value)}
              />
              <button type="button" onClick={calibrateSelected}>
                {m.calibrateThis}
              </button>
              <button type="button" className="secondary" onClick={resetSelected}>
                {m.resetDefault}
              </button>
              {selectedIsCustom ? (
                <button
                  type="button"
                  className="danger"
                  onClick={deleteSelectedCustom}
                >
                  {m.deleteProfession}
                </button>
              ) : null}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setEditingId((id) => (id === selected.id ? null : selected.id))
                }
              >
                {editingId === selected.id ? m.collapseSkills : m.editSkills}
              </button>
              {activeProfile ? (
                <button
                  type="button"
                  onClick={() => onApplyProfession(selected)}
                >
                  {m.applyToNamed(activeProfile.name)}
                </button>
              ) : null}
            </div>

            {editing && editing.id === selected.id ? (
              <div className="profession-skills">
                <p className="muted small">{m.skillTableHint}</p>
                <div className="profession-skill-head">
                  <span>{m.colUse}</span>
                  <span>{m.colName}</span>
                  <span>{m.colPercent}</span>
                  <span>{m.colHits}</span>
                  <span>{m.colUses}</span>
                  <span />
                </div>
                {editing.skills.map((row, index) => (
                  <div key={row.id} className="profession-skill-row">
                    <label className="check-inline">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          updateSkill(index, { enabled: e.target.checked })
                        }
                        aria-label={m.enableSkillAria(row.name)}
                      />
                    </label>
                    <input
                      value={row.name}
                      onChange={(e) => updateSkill(index, { name: e.target.value })}
                    />
                    <input
                      type="number"
                      step="1"
                      value={row.percent}
                      onChange={(e) =>
                        updateSkill(index, { percent: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={row.hits}
                      onChange={(e) =>
                        updateSkill(index, { hits: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={row.uses}
                      onChange={(e) =>
                        updateSkill(index, { uses: Number(e.target.value) })
                      }
                    />
                    <button
                      type="button"
                      className="danger"
                      onClick={() => removeSkill(index)}
                    >
                      {m.deleteShort}
                    </button>
                  </div>
                ))}
                <button type="button" className="secondary" onClick={addSkill}>
                  {m.addSkillRow}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2>{m.professionRankTitle}</h2>
        {!activeProfile ? (
          <p className="muted">{m.pickBuildForProfession}</p>
        ) : (
          <>
            <p className="muted small">{m.professionRankHint(activeProfile.name)}</p>
            <div className="filter-row">
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={useProfessionType}
                  onChange={(e) => setUseProfessionType(e.target.checked)}
                />
                {m.applyProfessionType}
              </label>
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={useProfessionElement}
                  onChange={(e) => setUseProfessionElement(e.target.checked)}
                />
                {m.applyProfessionElement}
              </label>
            </div>

            <div className="compare-table-wrap">
              <table className="compare-table profession-rank-table">
                <thead>
                  <tr>
                    <th>{m.colRank}</th>
                    <th>{m.colProfession}</th>
                    <th>{m.colType}</th>
                    <th>{m.colCycle}</th>
                    <th>{m.colTrainingDmg}</th>
                    <th>{m.colVsBest}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <ProfessionRankRowView
                      key={row.profession.id}
                      row={row}
                      isActive={activeProfile.professionId === row.profession.id}
                      isSelected={selectedId === row.profession.id}
                      onSelect={() => setSelectedId(row.profession.id)}
                      onApply={() => onApplyProfession(row.profession)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ProfessionRankRowView({
  row,
  isActive,
  isSelected,
  onSelect,
  onApply,
}: {
  row: ProfessionRankRow;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onApply: () => void;
}) {
  const { m } = useI18n();
  return (
    <tr
      className={[
        isActive ? "profession-row-active" : "",
        isSelected ? "profession-row-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <td className="num">{row.rank}</td>
      <td>
        <button type="button" className="linkish" onClick={onSelect}>
          <strong>
            {professionNameLabel(
              row.profession.id,
              undefined,
              row.profession.name,
            )}
          </strong>
        </button>
        <div className="muted small">
          {professionFamilyLabel(row.profession.family)}
          {isBuiltinProfessionId(row.profession.id)
            ? ""
            : ` · ${m.customProfession}`}
        </div>
      </td>
      <td>
        <div>
          {row.damageType === "magic" ? m.magic : m.physical} ·{" "}
          {circuitElementLabel(row.element)}
        </div>
      </td>
      <td className="num">{row.cycleMultiplier.toFixed(3)}</td>
      <td className="num">
        <strong>{formatDamage(row.result.trainingDamage)}</strong>
        <div className="muted small">
          {formatDamage(row.trainingDps)} {m.perSecond}
        </div>
      </td>
      <td>
        <div className="profession-bar-track">
          <span
            className="profession-bar"
            style={{ width: `${Math.max(row.ratioOfBest * 100, 2)}%` }}
          />
        </div>
        <div className="num muted small">{formatRatio(row.ratioOfBest)}</div>
      </td>
      <td>
        <button type="button" className="secondary" onClick={onApply}>
          {isActive ? m.applied : m.apply}
        </button>
      </td>
    </tr>
  );
}
