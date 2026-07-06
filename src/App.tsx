import { useEffect, useMemo, useState } from "react";
import "./App.css";

type BuildStats = Record<string, string | number | null>;

type BuildEntry = {
  id: string;
  name: string;
  profile: string;
  label: string;
  createdAt: string;
  stats: BuildStats;
};

type BuildFormState = {
  name: string;
  profile: string;
  label: string;
  attack: string;
  defenseBreak: string;
  critRate: string;
  critDamage: string;
  elementalPower: string;
  skillDamage: string;
  resonance: string;
  allDamage: string;
  shieldDamage: string;
  additionalDamage: string;
  statusDamage: string;
  bossDamage: string;
  penetration: string;
  trainingCorrection: string;
  skillMultiplier: string;
  finalDamage: string;
  damageComparison: string;
  improvement: string;
};

const STORAGE_KEY = "equipment-build-comparer:v1";

const DEFAULT_FORM: BuildFormState = {
  name: "",
  profile: "siumai",
  label: "",
  attack: "",
  defenseBreak: "",
  critRate: "",
  critDamage: "",
  elementalPower: "",
  skillDamage: "",
  resonance: "",
  allDamage: "",
  shieldDamage: "",
  additionalDamage: "",
  statusDamage: "",
  bossDamage: "",
  penetration: "",
  trainingCorrection: "",
  skillMultiplier: "",
  finalDamage: "",
  damageComparison: "",
  improvement: "",
};

const STAT_FIELDS: Array<{
  key: keyof BuildFormState;
  label: string;
}> = [
  { key: "attack", label: "攻擊" },
  { key: "defenseBreak", label: "破防" },
  { key: "critRate", label: "暴率" },
  { key: "critDamage", label: "爆傷" },
  { key: "elementalPower", label: "屬強" },
  { key: "skillDamage", label: "技傷" },
  { key: "resonance", label: "共鳴" },
  { key: "allDamage", label: "全傷" },
  { key: "shieldDamage", label: "破盾傷害" },
  { key: "additionalDamage", label: "附加傷害" },
  { key: "statusDamage", label: "異常" },
  { key: "bossDamage", label: "頭目" },
  { key: "penetration", label: "穿透" },
  { key: "trainingCorrection", label: "訓練場修正" },
  { key: "skillMultiplier", label: "技能倍率" },
  { key: "finalDamage", label: "最終傷害" },
  { key: "damageComparison", label: "傷害比較" },
  { key: "improvement", label: "提升%" },
];

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `build-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseMaybeNumber(value: string): string | number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, "");
  if (normalized.endsWith("%")) return trimmed;
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  return trimmed;
}

function formatStat(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }
  return String(value);
}

function toBuild(form: BuildFormState): BuildEntry {
  const stats: BuildStats = {};
  for (const field of STAT_FIELDS) {
    if (field.key === "finalDamage" || field.key === "damageComparison" ||
      field.key === "improvement") {
      continue;
    }
    stats[field.label] = parseMaybeNumber(form[field.key]);
  }

  return {
    id: makeId(),
    name: form.name.trim(),
    profile: form.profile.trim(),
    label: form.label.trim(),
    createdAt: new Date().toISOString(),
    stats: {
      ...stats,
      finalDamage: parseMaybeNumber(form.finalDamage),
      damageComparison: parseMaybeNumber(form.damageComparison),
      improvement: parseMaybeNumber(form.improvement),
    },
  };
}

function App() {
  const [builds, setBuilds] = useState<BuildEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState<BuildFormState>(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BuildEntry[];
      if (Array.isArray(parsed)) {
        setBuilds(parsed);
      }
    } catch {
      setStatus("Loaded data is invalid. Starting with empty storage.");
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
    } catch {
      setStatus("Failed to save to browser storage.");
    }
  }, [builds]);

  const selectedBuilds = useMemo(() => {
    return builds.filter((build) => selectedIds.includes(build.id));
  }, [builds, selectedIds]);

  function updateField(
    key: keyof BuildFormState,
    value: string,
  ): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm(): void {
    setForm(DEFAULT_FORM);
    setEditId(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!form.name.trim()) {
      setStatus("Build name is required.");
      return;
    }

    const build = toBuild(form);

    if (editId) {
      setBuilds((current) =>
        current.map((item) =>
          item.id === editId ? { ...build, id: editId } : item,
        ),
      );
      setStatus("Build updated.");
    } else {
      setBuilds((current) => [build, ...current]);
      setStatus("Build saved.");
    }

    resetForm();
  }

  function handleEdit(build: BuildEntry): void {
    setEditId(build.id);
    setForm({
      name: build.name,
      profile: build.profile,
      label: build.label,
      attack: String(build.stats["攻擊"] ?? ""),
      defenseBreak: String(build.stats["破防"] ?? ""),
      critRate: String(build.stats["暴率"] ?? ""),
      critDamage: String(build.stats["爆傷"] ?? ""),
      elementalPower: String(build.stats["屬強"] ?? ""),
      skillDamage: String(build.stats["技傷"] ?? ""),
      resonance: String(build.stats["共鳴"] ?? ""),
      allDamage: String(build.stats["全傷"] ?? ""),
      shieldDamage: String(build.stats["破盾傷害"] ?? ""),
      additionalDamage: String(build.stats["附加傷害"] ?? ""),
      statusDamage: String(build.stats["異常"] ?? ""),
      bossDamage: String(build.stats["頭目"] ?? ""),
      penetration: String(build.stats["穿透"] ?? ""),
      trainingCorrection: String(build.stats["訓練場修正"] ?? ""),
      skillMultiplier: String(build.stats["技能倍率"] ?? ""),
      finalDamage: String(build.stats["最終傷害"] ?? ""),
      damageComparison: String(build.stats["傷害比較"] ?? ""),
      improvement: String(build.stats["提升%"] ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete(id: string): void {
    const next = builds.filter((build) => build.id !== id);
    setBuilds(next);
    setSelectedIds((current) => current.filter((item) => item !== id));
    setStatus("Build deleted.");
  }

  function toggleSelected(id: string): void {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(0, 4),
    );
  }

  function exportJson(): void {
    const blob = new Blob([JSON.stringify(builds, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "equipment-builds.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Export completed.");
  }

  async function handleImport(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BuildEntry[];
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid format");
      }
      setBuilds(parsed);
      setSelectedIds([]);
      setStatus("Import completed.");
    } catch {
      setStatus("Import failed: invalid JSON file.");
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Equipment Build Comparer</h1>
          <p>
            Save gear setups locally and compare them side by side in the
            browser.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={exportJson}>Export JSON</button>
          <label className="file-button">
            Import JSON
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>{editId ? "Edit build" : "Add build"}</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Build name
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </label>

            <label>
              Profile
              <input
                value={form.profile}
                onChange={(e) => updateField("profile", e.target.value)}
              />
            </label>

            <label>
              Label
              <input
                value={form.label}
                onChange={(e) => updateField("label", e.target.value)}
              />
            </label>

            <div className="stats-grid">
              {STAT_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    value={form[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="form-actions">
              <button type="submit">
                {editId ? "Update build" : "Save build"}
              </button>
              <button type="button" className="secondary" onClick={resetForm}>
                Clear
              </button>
            </div>
          </form>
          {status ? <p className="status">{status}</p> : null}
        </section>

        <section className="panel">
          <h2>Saved builds</h2>
          <div className="build-list">
            {builds.length === 0 ? (
              <p>No saved builds yet.</p>
            ) : (
              builds.map((build) => {
                const active = selectedIds.includes(build.id);
                return (
                  <article
                    key={build.id}
                    className={`build-card ${active ? "active" : ""}`}
                  >
                    <div className="build-card-header">
                      <div>
                        <h3>{build.name || "(untitled)"}</h3>
                        <p>
                          {build.profile}
                          {build.label ? ` · ${build.label}` : ""}
                        </p>
                        <small>{new Date(build.createdAt).toLocaleString()}</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleSelected(build.id)}
                        aria-label={`Select ${build.name}`}
                      />
                    </div>

                    <dl className="stat-list">
                      {STAT_FIELDS.slice(0, 8).map((field) => (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>{formatStat(build.stats[field.label])}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="card-actions">
                      <button type="button" onClick={() => handleEdit(build)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(build.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel wide">
          <h2>Comparison</h2>
          {selectedBuilds.length < 2 ? (
            <p>Select at least 2 builds to compare.</p>
          ) : (
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Stat</th>
                    {selectedBuilds.map((build) => (
                      <th key={build.id}>{build.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAT_FIELDS.map((field) => (
                    <tr key={field.key}>
                      <td>{field.label}</td>
                      {selectedBuilds.map((build) => (
                        <td key={`${build.id}-${field.key}`}>
                          {formatStat(build.stats[field.label])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
