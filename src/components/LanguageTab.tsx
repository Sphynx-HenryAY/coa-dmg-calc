import { useMemo, useState } from "react";
import { useI18n } from "../lib/I18nProvider";
import {
  getBaseTranslations,
  isBuiltinLocale,
  LOCALE_CATEGORIES,
  localeToUserLocale,
  resources,
  saveUserLocale,
  deleteUserLocale,
  SUPPORTED_LOCALES,
  translationsToUserLocale,
  type UserLocale,
} from "../lib/i18n";
import { useAppStore } from "../store/AppStore";

type Draft = UserLocale;

function emptyDraft(): Draft {
  return { meta: { htmlLang: "", label: "" }, messages: {} };
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function entryToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "tpl" in value) {
    return (value as { tpl: string }).tpl;
  }
  return "";
}

export function LanguageTab() {
  const { m, setLocale } = useI18n();
  const { setStatus: onStatus } = useAppStore();
  const base = getBaseTranslations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  void version;

  const refresh = () => setVersion((v) => v + 1);

  const setMsg = (key: string, val: string) =>
    setDraft((d) => (d ? { ...d, messages: { ...d.messages, [key]: val } } : d));
  const setCat = (cat: keyof UserLocale, key: string, val: string) =>
    setDraft((d) =>
      d ? { ...d, [cat]: { ...(d[cat] as Record<string, string>), [key]: val } } : d,
    );

  const startNew = () => {
    setCode("");
    setDraft(emptyDraft());
  };
  const startEdit = (c: string) => {
    setCode(c);
    setDraft(localeToUserLocale(c));
  };

  const onSave = () => {
    const c = code.trim().toLowerCase();
    if (!c) {
      onStatus?.(m.langNeedCode);
      return;
    }
    const data: Draft = {
      ...(draft as Draft),
      meta: {
        htmlLang: (draft?.meta.htmlLang || c).trim(),
        label: (draft?.meta.label || c).trim(),
      },
    };
    saveUserLocale(c, data);
    refresh();
    setLocale(c);
    onStatus?.(m.langSaved(c));
  };

  const onDelete = (c: string) => {
    if (!window.confirm(m.langDeleteConfirm(c))) return;
    deleteUserLocale(c);
    refresh();
    onStatus?.(m.langImported(c));
  };

  const onExport = () => {
    const c = code.trim().toLowerCase();
    if (!c || !resources[c]) {
      onStatus?.(m.langNeedCode);
      return;
    }
    download(`${c}.json`, JSON.stringify(resources[c], null, 2));
    onStatus?.(m.langExported(`${c}.json`));
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ReturnType<
          typeof getBaseTranslations
        >;
        if (!parsed || typeof parsed !== "object" || !("messages" in parsed)) {
          throw new Error("bad");
        }
        const c = file.name.replace(/\.json$/i, "").toLowerCase();
        const data = translationsToUserLocale(parsed);
        setDraft(data);
        setCode(c);
        onStatus?.(m.langImportApply);
      } catch {
        onStatus?.(m.langImportBad);
      }
    };
    reader.readAsText(file);
  };

  const onReset = () => setDraft((d) => (d ? { ...d, messages: {} } : d));

  const q = search.trim().toLowerCase();
  const totalMsg = Object.keys(base.messages).length;
  const doneMsg = draft
    ? Object.keys(base.messages).filter((k) => (draft.messages[k] ?? "").trim() !== "")
        .length
    : 0;

  const filteredMessages = useMemo(() => {
    return Object.keys(base.messages).filter((k) => {
      if (!q) return true;
      const bv = entryToText(base.messages[k]).toLowerCase();
      const dv = (draft?.messages[k] ?? "").toLowerCase();
      return k.toLowerCase().includes(q) || bv.includes(q) || dv.includes(q);
    });
  }, [base, draft, q]);

  const filteredLabels = useMemo(() => {
    const out: { cat: string; key: string; base: string }[] = [];
    for (const cat of LOCALE_CATEGORIES) {
      const map = base[cat] as Record<string, string>;
      for (const key of Object.keys(map)) {
        if (!q) {
          out.push({ cat, key, base: map[key] });
        } else {
          const dv = (draft?.[cat as keyof Draft] as Record<string, string> | undefined)?.[
            key
          ]?.toLowerCase();
          if (
            key.toLowerCase().includes(q) ||
            map[key].toLowerCase().includes(q) ||
            dv?.includes(q)
          ) {
            out.push({ cat, key, base: map[key] });
          }
        }
      }
    }
    return out;
  }, [base, draft, q]);

  return (
    <section className="panel wide">
      <h2>{m.langEditorTitle}</h2>
      <p className="muted">{m.langEditorHint}</p>

      <div className="lang-list">
        {SUPPORTED_LOCALES.map((c) => (
          <div key={c} className="lang-list-row">
            <span className="lang-list-label">{resources[c]?.meta.label ?? c}</span>
            <span className="lang-list-code">{c}</span>
            <span className="tag">
              {isBuiltinLocale(c) ? m.langBuiltin : m.langLocal}
            </span>
            <button type="button" className="secondary" onClick={() => startEdit(c)}>
              {m.langEdit}
            </button>
            {!isBuiltinLocale(c) && (
              <button type="button" className="secondary" onClick={() => onDelete(c)}>
                {m.langDelete}
              </button>
            )}
          </div>
        ))}
        <button type="button" className="secondary" onClick={startNew}>
          + {m.langNew}
        </button>
      </div>

      {draft ? (
        <div className="lang-editor">
          <div className="lang-meta">
            <label className="inline-label">
              {m.langCode}
              <input
                value={code}
                placeholder={m.langCodePh}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label className="inline-label">
              {m.langLabel}
              <input
                value={draft.meta.label}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, meta: { ...d.meta, label: e.target.value } } : d))
                }
              />
            </label>
            <label className="inline-label">
              {m.langHtmlLang}
              <input
                value={draft.meta.htmlLang}
                placeholder={m.langHtmlLangPh}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, meta: { ...d.meta, htmlLang: e.target.value } } : d,
                  )
                }
              />
            </label>
          </div>

          <div className="lang-toolbar">
            <input
              className="lang-search"
              value={search}
              placeholder={m.langSearch}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="muted small">
              {m.langProgress(doneMsg, totalMsg)}
            </span>
            <button type="button" className="secondary" onClick={onReset}>
              {m.langReset}
            </button>
            <label className="secondary file-btn">
              {m.langImport}
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onImport(f);
                }}
              />
            </label>
            <button type="button" className="secondary" onClick={onExport}>
              {m.langExport}
            </button>
            <button type="button" onClick={onSave}>
              {m.langSave}
            </button>
          </div>

          <p className="muted small">{m.langPlaceholdersHint}</p>
          <p className="muted small">{m.langUntranslatedNote}</p>

          <h3>{m.langGroupLabels}</h3>
          <div className="lang-grid">
            {filteredLabels.map(({ cat, key, base: bv }) => (
              <div key={`${cat}.${key}`} className="lang-field">
                <div className="lang-field-key">
                  {cat}.{key}
                </div>
                <div className="lang-field-base">{bv}</div>
                <input
                  value={(draft[cat as keyof Draft] as Record<string, string> | undefined)?.[key] ?? ""}
                  onChange={(e) => setCat(cat as keyof Draft, key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <h3>{m.langGroupMessages}</h3>
          <div className="lang-grid">
            {filteredMessages.map((k) => {
              const be = base.messages[k];
              const isFn = typeof be === "object" && be !== null && "tpl" in be;
              const baseText = entryToText(be);
              const args = isFn ? (be as { args: string[] }).args : [];
              const val = draft.messages[k] ?? "";
              return (
                <div key={k} className="lang-field">
                  <div className="lang-field-key">
                    {k}
                    {args.length > 0 ? ` (${args.join(", ")})` : ""}
                  </div>
                  <div className="lang-field-base">{baseText}</div>
                  <textarea
                    rows={baseText.includes("\n") ? 3 : 1}
                    value={val}
                    onChange={(e) => setMsg(k, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="muted">{m.langEditExisting}</p>
      )}
    </section>
  );
}
