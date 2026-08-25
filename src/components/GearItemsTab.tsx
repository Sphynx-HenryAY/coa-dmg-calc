import { useMemo, useRef, useState } from "react";
import type { CatalogItem, Equipment } from "../lib/types";
import {
  GEAR_CSV_TEMPLATE,
  ITEM_CSV_TEMPLATE,
  applyEquipmentImport,
  applyItemImport,
  downloadText,
  equipmentToCsv,
  importEquipmentCsv,
  importItemsCsv,
  itemsToCsv,
  parseStatLines,
  statsToText,
} from "../lib/catalog";
import { makeId } from "../lib/damage";
import { EQUIPMENT_SLOTS } from "../lib/storage";
import { activeSourceIdsOf } from "../lib/types";
import { slotLabel } from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";
import { useAppStore } from "../store/AppStore";

export function GearItemsTab() {
  const { m } = useI18n();
  const {
    customEquipment,
    setCustomEquipment,
    customItems,
    setCustomItems,
    demoEquipment,
    demoItems,
    allEquipment,
    allItems,
    setHiddenEquipmentIds,
    setHiddenItemIds,
    setProfiles,
    setStatus,
  } = useAppStore();

  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [gearName, setGearName] = useState("");
  const [gearSlot, setGearSlot] = useState("項鍊");
  const [gearSet, setGearSet] = useState(() => m.customDefault);
  const [gearStats, setGearStats] = useState("");
  const [gearEffects, setGearEffects] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemStats, setItemStats] = useState("");

  const [gearFilter, setGearFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("");

  const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const gearImportRef = useRef<HTMLInputElement>(null);
  const itemImportRef = useRef<HTMLInputElement>(null);

  const slotsInUse = useMemo(() => {
    const set = new Set<string>(EQUIPMENT_SLOTS as unknown as string[]);
    for (const e of allEquipment) set.add(e.slot);
    return [...set];
  }, [allEquipment]);

  const filteredGear = allEquipment.filter((e) => {
    if (slotFilter !== "all" && e.slot !== slotFilter) return false;
    if (!gearFilter.trim()) return true;
    const q = gearFilter.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.set ?? "").toLowerCase().includes(q) ||
      e.slot.toLowerCase().includes(q)
    );
  });

  const filteredItems = allItems.filter((item) => {
    if (!itemFilter.trim()) return true;
    const q = itemFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.statLines.some((line) => line.toLowerCase().includes(q))
    );
  });

  const allFilteredGearSelected =
    filteredGear.length > 0 &&
    filteredGear.every((e) => selectedGearIds.includes(e.id));
  const allFilteredItemsSelected =
    filteredItems.length > 0 &&
    filteredItems.every((e) => selectedItemIds.includes(e.id));

  function resetGearForm(): void {
    setEditingGearId(null);
    setGearName("");
    setGearSlot("項鍊");
    setGearSet(m.customDefault);
    setGearStats("");
    setGearEffects("");
  }

  function resetItemForm(): void {
    setEditingItemId(null);
    setItemName("");
    setItemStats("");
  }

  function startEditGear(eq: Equipment): void {
    setEditingGearId(eq.id);
    setGearName(eq.name);
    setGearSlot(eq.slot);
    setGearSet(eq.set ?? m.customDefault);
    setGearStats(statsToText(eq.stats, eq.statLines));
    setGearEffects((eq.effects ?? []).join("\n"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditItem(item: CatalogItem): void {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemStats(statsToText(item.stats, item.statLines));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveGearForm(): void {
    if (!gearName.trim()) {
      setStatus(m.needGearName);
      return;
    }
    const { stats, lines } = parseStatLines(gearStats);
    const effects = gearEffects
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const base: Equipment = {
      id: editingGearId ?? makeId("gear"),
      name: gearName.trim(),
      slot: gearSlot,
      set: gearSet.trim() || m.customDefault,
      stats,
      statLines: lines.length ? lines : [m.noParsedStats],
      effects,
      source: "custom",
      demo: false,
    };

    setCustomEquipment((list) => {
      const idx = list.findIndex((e) => e.id === base.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...list[idx], ...base, demo: false };
        return next;
      }
      return [base, ...list];
    });
    setHiddenEquipmentIds((ids) => ids.filter((id) => id !== base.id));
    setStatus(editingGearId ? m.updatedGear(base.name) : m.addedGear(base.name));
    resetGearForm();
  }

  function saveItemForm(): void {
    if (!itemName.trim()) {
      setStatus(m.needItemName);
      return;
    }
    const { stats, lines } = parseStatLines(itemStats);
    const base: CatalogItem = {
      id: editingItemId ?? makeId("item"),
      name: itemName.trim(),
      kind: "item",
      stats,
      statLines: lines.length ? lines : [m.noParsedStats],
      demo: false,
    };

    setCustomItems((list) => {
      const idx = list.findIndex((e) => e.id === base.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...list[idx], ...base, demo: false };
        return next;
      }
      return [base, ...list];
    });
    setHiddenItemIds((ids) => ids.filter((id) => id !== base.id));
    setStatus(editingItemId ? m.updatedItem(base.name) : m.addedItem(base.name));
    resetItemForm();
  }

  function detachGearFromProfiles(ids: string[]): void {
    const idSet = new Set(ids);
    setProfiles((list) =>
      list.map((p) => {
        const equipped = { ...p.equipped };
        for (const [slot, eqId] of Object.entries(equipped)) {
          if (eqId && idSet.has(eqId)) equipped[slot] = null;
        }
        const next = { ...p, equipped };
        next.activeSourceIds = activeSourceIdsOf(next);
        return next;
      }),
    );
  }

  function detachItemsFromProfiles(ids: string[]): void {
    const idSet = new Set(ids);
    setProfiles((list) =>
      list.map((p) => {
        const next = {
          ...p,
          itemIds: p.itemIds.filter((x) => !idSet.has(x)),
        };
        next.activeSourceIds = activeSourceIdsOf(next);
        return next;
      }),
    );
  }

  function deleteEquipmentIds(ids: string[]): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const demoIdSet = new Set(demoEquipment.map((e) => e.id));

    setCustomEquipment((list) => list.filter((e) => !idSet.has(e.id)));
    setHiddenEquipmentIds((hidden) => {
      const next = new Set(hidden);
      for (const id of ids) {
        if (demoIdSet.has(id)) next.add(id);
      }
      return [...next];
    });
    detachGearFromProfiles(ids);
    setSelectedGearIds((sel) => sel.filter((id) => !idSet.has(id)));
    if (editingGearId && idSet.has(editingGearId)) resetGearForm();
    setStatus(m.deletedGearN(ids.length));
  }

  function deleteItemIds(ids: string[]): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const demoIdSet = new Set(demoItems.map((e) => e.id));

    setCustomItems((list) => list.filter((e) => !idSet.has(e.id)));
    setHiddenItemIds((hidden) => {
      const next = new Set(hidden);
      for (const id of ids) {
        if (demoIdSet.has(id)) next.add(id);
      }
      return [...next];
    });
    detachItemsFromProfiles(ids);
    setSelectedItemIds((sel) => sel.filter((id) => !idSet.has(id)));
    if (editingItemId && idSet.has(editingItemId)) resetItemForm();
    setStatus(m.deletedItemN(ids.length));
  }

  function toggleGearSelect(id: string): void {
    setSelectedGearIds((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id],
    );
  }

  function toggleItemSelect(id: string): void {
    setSelectedItemIds((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id],
    );
  }

  async function handleGearCsvImport(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = importEquipmentCsv(text, allEquipment);
      if (result.created.length === 0 && result.updated.length === 0) {
        setStatus(
          result.errors.length
            ? m.importFailErrors(result.errors.slice(0, 3).join("; "))
            : m.importFailEmpty,
        );
        return;
      }
      setCustomEquipment((list) => applyEquipmentImport(list, result));
      const touchIds = [
        ...result.created.map((e) => e.id),
        ...result.updated.map((e) => e.id),
      ];
      setHiddenEquipmentIds((ids) => ids.filter((id) => !touchIds.includes(id)));
      const errNote = result.errors.length
        ? m.skippedRows(result.errors.length)
        : "";
      setStatus(
        m.gearImportDone(result.created.length, result.updated.length, errNote),
      );
    } catch {
      setStatus(m.gearCsvFail);
    }
  }

  async function handleItemCsvImport(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = importItemsCsv(text, allItems);
      if (result.created.length === 0 && result.updated.length === 0) {
        setStatus(
          result.errors.length
            ? m.importFailErrors(result.errors.slice(0, 3).join("; "))
            : m.importFailEmpty,
        );
        return;
      }
      setCustomItems((list) => applyItemImport(list, result));
      const touchIds = [
        ...result.created.map((e) => e.id),
        ...result.updated.map((e) => e.id),
      ];
      setHiddenItemIds((ids) => ids.filter((id) => !touchIds.includes(id)));
      const errNote = result.errors.length
        ? m.skippedRows(result.errors.length)
        : "";
      setStatus(
        m.itemImportDone(result.created.length, result.updated.length, errNote),
      );
    } catch {
      setStatus(m.itemCsvFail);
    }
  }

  return (
    <div className="layout-2">
      <section className="panel">
        <h2>{editingGearId ? m.editGear : m.addGear}</h2>
        <p className="muted small">
          {m.gearStatHint} <code>Skill DMG +12%</code>, <code>技能傷害 +12%</code>
        </p>
        <div className="form-grid">
          <label>
            {m.name}
            <input
              value={gearName}
              onChange={(e) => setGearName(e.target.value)}
              placeholder={m.gearNamePh}
            />
          </label>
          <label>
            {m.slot}
            <select
              value={gearSlot}
              onChange={(e) => setGearSlot(e.target.value)}
            >
              {slotsInUse.map((s) => (
                <option key={s} value={s}>
                  {slotLabel(s)}
                </option>
              ))}
              <option value="其他">{m.otherSlot}</option>
            </select>
          </label>
          <label>
            {m.setName}
            <input
              value={gearSet}
              onChange={(e) => setGearSet(e.target.value)}
              placeholder={m.setPh}
            />
          </label>
          <label>
            {m.statsMultiline}
            <textarea
              rows={6}
              value={gearStats}
              onChange={(e) => setGearStats(e.target.value)}
              placeholder={m.gearStatsPh}
            />
          </label>
          <label>
            {m.effectsOptional}
            <textarea
              rows={3}
              value={gearEffects}
              onChange={(e) => setGearEffects(e.target.value)}
              placeholder={m.effectsPh}
            />
          </label>
          <div className="form-actions">
            <button type="button" onClick={saveGearForm}>
              {editingGearId ? m.saveChanges : m.addGear}
            </button>
            {editingGearId ? (
              <button
                type="button"
                className="secondary"
                onClick={resetGearForm}
              >
                {m.cancelEdit}
              </button>
            ) : null}
          </div>
        </div>

        <h3 className="section-title">{m.batchImport}</h3>
        <p className="muted small">{m.gearCsvHint}</p>
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              downloadText("equipment-template.csv", GEAR_CSV_TEMPLATE)
            }
          >
            {m.downloadCsvTemplate}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              downloadText("equipment-export.csv", equipmentToCsv(allEquipment))
            }
          >
            {m.exportGearCsv}
          </button>
          <label className="file-button">
            {m.importCsv}
            <input
              ref={gearImportRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleGearCsvImport(e)}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>
          {m.tabGear}{" "}
          <span className="muted small">
            ({filteredGear.length} / {allEquipment.length})
          </span>
        </h2>
        <p className="muted small">
          {m.gearLibHint}
        </p>
        <div className="filter-row">
          <input
            placeholder={m.searchGear}
            value={gearFilter}
            onChange={(e) => setGearFilter(e.target.value)}
          />
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
          >
            <option value="all">{m.allSlots}</option>
            {slotsInUse.map((s) => (
              <option key={s} value={s}>
                {slotLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="batch-bar">
          <label className="check-inline">
            <input
              type="checkbox"
              checked={allFilteredGearSelected}
              onChange={() => {
                if (allFilteredGearSelected) {
                  const visible = new Set(filteredGear.map((e) => e.id));
                  setSelectedGearIds((sel) =>
                    sel.filter((id) => !visible.has(id)),
                  );
                } else {
                  setSelectedGearIds((sel) => [
                    ...new Set([...sel, ...filteredGear.map((e) => e.id)]),
                  ]);
                }
              }}
            />
            {m.selectAllVisible}
          </label>
          <span className="muted small">
            {m.selectedCount(selectedGearIds.length)}
          </span>
          <button
            type="button"
            className="danger"
            disabled={selectedGearIds.length === 0}
            onClick={() => {
              if (
                window.confirm(m.confirmDeleteGearN(selectedGearIds.length))
              ) {
                deleteEquipmentIds(selectedGearIds);
              }
            }}
          >
            {m.deleteSelected}
          </button>
        </div>
        <div className="gear-list">
          {filteredGear.map((e) => {
            const selected = selectedGearIds.includes(e.id);
            const isUserOwned = customEquipment.some((c) => c.id === e.id);
            return (
              <article
                key={e.id}
                className={`gear-card ${selected ? "selected" : ""} ${
                  editingGearId === e.id ? "editing" : ""
                }`}
              >
                <div className="gear-card-head">
                  <label className="check-inline card-select">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleGearSelect(e.id)}
                    />
                  </label>
                  <div className="gear-card-body">
                    <h3>
                      {e.name}
                      {isUserOwned ? " ★" : ""}
                    </h3>
                    <p className="muted small">
                      {e.slot}
                      {e.set ? ` · ${e.set}` : ""}
                      {e.source ? ` · ${e.source}` : ""}
                    </p>
                  </div>
                  <div className="card-actions tight">
                    <button type="button" onClick={() => startEditGear(e)}>
                      {m.edit}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (window.confirm(m.confirmDeleteNamed(e.name))) {
                          deleteEquipmentIds([e.id]);
                        }
                      }}
                    >
                      {m.delete}
                    </button>
                  </div>
                </div>
                <ul className="stat-lines">
                  {e.statLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {e.effects.length > 0 ? (
                  <details>
                    <summary>{m.effectsSummary}</summary>
                    <ul className="effect-lines">
                      {e.effects.map((fx) => (
                        <li key={fx}>{fx}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>{editingItemId ? m.editItem : m.addItem}</h2>
        <div className="form-grid">
          <label>
            {m.name}
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={m.itemNamePh}
            />
          </label>
          <label>
            {m.statsMultiline}
            <textarea
              rows={5}
              value={itemStats}
              onChange={(e) => setItemStats(e.target.value)}
              placeholder={m.itemStatsPh}
            />
          </label>
          <div className="form-actions">
            <button type="button" onClick={saveItemForm}>
              {editingItemId ? m.saveChanges : m.addItemBtn}
            </button>
            {editingItemId ? (
              <button
                type="button"
                className="secondary"
                onClick={resetItemForm}
              >
                {m.cancelEdit}
              </button>
            ) : null}
          </div>
        </div>

        <h3 className="section-title">{m.batchImport}</h3>
        <p className="muted small">{m.itemCsvHint}</p>
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              downloadText("items-template.csv", ITEM_CSV_TEMPLATE)
            }
          >
            {m.downloadCsvTemplate}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              downloadText("items-export.csv", itemsToCsv(allItems))
            }
          >
            {m.exportItemCsv}
          </button>
          <label className="file-button">
            {m.importCsv}
            <input
              ref={itemImportRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleItemCsvImport(e)}
            />
          </label>
        </div>
      </section>
      <section className="panel">
        <h2>
          {m.tabItems}{" "}
          <span className="muted small">
            ({filteredItems.length} / {allItems.length})
          </span>
        </h2>
        <p className="muted small">
          {m.itemLibHint}
        </p>
        <div className="filter-row">
          <input
            placeholder={m.searchItems}
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
          />
        </div>
        <div className="batch-bar">
          <label className="check-inline">
            <input
              type="checkbox"
              checked={allFilteredItemsSelected}
              onChange={() => {
                if (allFilteredItemsSelected) {
                  const visible = new Set(filteredItems.map((e) => e.id));
                  setSelectedItemIds((sel) =>
                    sel.filter((id) => !visible.has(id)),
                  );
                } else {
                  setSelectedItemIds((sel) => [
                    ...new Set([...sel, ...filteredItems.map((e) => e.id)]),
                  ]);
                }
              }}
            />
            {m.selectAllVisible}
          </label>
          <span className="muted small">
            {m.selectedCount(selectedItemIds.length)}
          </span>
          <button
            type="button"
            className="danger"
            disabled={selectedItemIds.length === 0}
            onClick={() => {
              if (
                window.confirm(m.confirmDeleteItemN(selectedItemIds.length))
              ) {
                deleteItemIds(selectedItemIds);
              }
            }}
          >
            {m.deleteSelected}
          </button>
        </div>
        <div className="gear-list">
          {filteredItems.map((item) => {
            const selected = selectedItemIds.includes(item.id);
            const isCustom = customItems.some((c) => c.id === item.id);
            return (
              <article
                key={item.id}
                className={`gear-card ${selected ? "selected" : ""} ${
                  editingItemId === item.id ? "editing" : ""
                }`}
              >
                <div className="gear-card-head">
                  <label className="check-inline card-select">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleItemSelect(item.id)}
                    />
                  </label>
                  <div className="gear-card-body">
                    <h3>
                      {item.name}
                      {isCustom || !item.demo ? " ★" : ""}
                    </h3>
                  </div>
                  <div className="card-actions tight">
                    <button
                      type="button"
                      onClick={() => startEditItem(item)}
                    >
                      {m.edit}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (window.confirm(m.confirmDeleteNamed(item.name))) {
                          deleteItemIds([item.id]);
                        }
                      }}
                    >
                      {m.delete}
                    </button>
                  </div>
                </div>
                <ul className="stat-lines">
                  {item.statLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
