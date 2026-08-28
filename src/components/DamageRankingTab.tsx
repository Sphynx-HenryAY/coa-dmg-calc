import { useMemo, useState } from "react";
import { makeId } from "../lib/damage";
import { useAppStore } from "../store/AppStore";
import { useI18n } from "../lib/I18nProvider";

const TRAINING_SECONDS = 90;

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function DamageRankingTab(): React.JSX.Element {
  const { m } = useI18n();
  const { rankEntries, setRankEntries, setStatus } = useAppStore();
  const [name, setName] = useState("");
  const [damage, setDamage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...rankEntries].sort((a, b) => b.damage - a.damage),
    [rankEntries],
  );

  const submit = (): void => {
    const trimmed = name.trim();
    const value = Number(damage);
    if (!trimmed) {
      setStatus(m.rankNeedName);
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setStatus(m.rankNeedDamage);
      return;
    }
    const now = new Date().toISOString();
    if (editingId) {
      setRankEntries((list) =>
        list.map((e) =>
          e.id === editingId
            ? { ...e, name: trimmed, damage: value, updatedAt: now }
            : e,
        ),
      );
      setStatus(m.rankUpdated);
      setEditingId(null);
    } else {
      setRankEntries((list) => [
        ...list,
        { id: makeId("rank"), name: trimmed, damage: value, createdAt: now, updatedAt: now },
      ]);
      setStatus(m.rankAdded);
    }
    setName("");
    setDamage("");
  };

  const startEdit = (id: string): void => {
    const entry = rankEntries.find((e) => e.id === id);
    if (!entry) return;
    setName(entry.name);
    setDamage(String(entry.damage));
    setEditingId(id);
  };

  const cancelEdit = (): void => {
    setName("");
    setDamage("");
    setEditingId(null);
  };

  const remove = (id: string): void => {
    const entry = rankEntries.find((e) => e.id === id);
    if (entry && !window.confirm(m.rankConfirmDelete(entry.name))) return;
    setRankEntries((list) => list.filter((e) => e.id !== id));
    if (editingId === id) cancelEdit();
    setStatus(m.rankDeleted);
  };

  return (
    <div className="panel">
      <h2>{m.rankTitle}</h2>
      <p className="muted small">{m.rankHint}</p>

      <div className="ranking-form">
        <label>
          {m.rankName}
          <input
            type="text"
            value={name}
            placeholder={m.rankNamePh}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {m.rankDamage}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={damage}
            placeholder={m.rankDamagePh}
            onChange={(e) => setDamage(e.target.value)}
          />
        </label>
        <div className="form-actions">
          {editingId ? (
            <>
              <button type="button" onClick={submit}>
                {m.rankSave}
              </button>
              <button type="button" className="secondary" onClick={cancelEdit}>
                {m.rankCancel}
              </button>
            </>
          ) : (
            <button type="button" onClick={submit}>
              {m.rankAdd}
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="muted small" style={{ marginTop: 16 }}>
          {m.rankNoEntries}
        </p>
      ) : (
        <ol className="ranking-list">
          {sorted.map((entry, index) => (
            <li key={entry.id} className="ranking-item">
              <span className="ranking-rank">{index + 1}</span>
              <div className="ranking-body">
                <div className="ranking-name">{entry.name}</div>
                <div className="ranking-meta muted small">
                  {formatNumber(entry.damage)} · {m.rankDps}{" "}
                  {formatNumber(Math.round(entry.damage / TRAINING_SECONDS))}
                  {m.rankPerSecond}
                </div>
              </div>
              <div className="ranking-actions card-actions tight">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => startEdit(entry.id)}
                >
                  {m.rankEdit}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => remove(entry.id)}
                >
                  {m.rankDelete}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
