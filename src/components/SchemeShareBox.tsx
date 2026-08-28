import { useState } from "react";
import type { SchemeShareKind } from "../lib/schemeShare";
import { peekSchemeShareKind } from "../lib/schemeShare";
import { useI18n } from "../lib/I18nProvider";

type SchemeShareBoxProps = {
  kind: SchemeShareKind;
  canExport: boolean;
  exportDisabledReason?: string;
  onExport: () => Promise<string>;
  onImport: (code: string) => Promise<void>;
  onStatus: (msg: string) => void;
};

export function SchemeShareBox({
  kind,
  canExport,
  exportDisabledReason,
  onExport,
  onImport,
  onStatus,
}: SchemeShareBoxProps) {
  const { m } = useI18n();
  const kindWord =
    kind === "circuit"
      ? m.circuitSchemeWord
      : kind === "deck"
        ? m.deckSchemeWord
        : kind === "pet"
          ? m.petSchemeWord
          : m.insigniaSchemeWord;
  const [draft, setDraft] = useState("");
  const [lastExported, setLastExported] = useState("");
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function handleExport(): Promise<void> {
    if (!canExport || busy) return;
    setBusy("export");
    try {
      const code = await onExport();
      setLastExported(code);
      setDraft(code);
      const copied = await copyText(code);
      onStatus(
        copied
          ? m.copiedKind(kindWord, code.length)
          : m.generatedKind(kindWord, code.length),
      );
    } catch {
      onStatus(m.exportKindFail(kindWord));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(): Promise<void> {
    const code = draft.trim();
    if (!code || busy) return;
    const found = peekSchemeShareKind(code);
    if (found && found !== kind) {
      onStatus(
        found === "circuit"
          ? m.circuitCodeWrongTab
          : found === "deck"
            ? m.deckCodeWrongTab
            : found === "pet"
              ? m.petCodeWrongTab
              : m.insigniaCodeWrongTab,
      );
      return;
    }
    setBusy("import");
    try {
      await onImport(code);
      setDraft("");
    } catch (err) {
      const message = err instanceof Error ? err.message : m.importFail;
      onStatus(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="scheme-share">
      <div className="scheme-share-head">
        <h3 className="section-title" style={{ margin: 0 }}>
          {m.schemeShare}
        </h3>
        <button
          type="button"
          className="secondary"
          disabled={!canExport || busy !== null}
          title={
            !canExport
              ? (exportDisabledReason ?? m.pickSchemeExport)
              : m.copyCompressed
          }
          onClick={() => void handleExport()}
        >
          {busy === "export" ? m.exporting : m.exportString}
        </button>
      </div>
      <p className="muted small">
        {kind === "circuit"
          ? m.shareBoxHintCircuit
          : kind === "deck"
            ? m.shareBoxHintDeck
            : kind === "pet"
              ? m.shareBoxHintPet
              : m.shareBoxHintInsignia}
      </p>
      <label>
        {m.schemeString}
        <textarea
          className="scheme-share-input"
          rows={3}
          spellCheck={false}
          value={draft}
          placeholder={
            kind === "circuit"
              ? m.shareBoxPlaceholderCircuit
              : kind === "deck"
                ? m.shareBoxPlaceholderDeck
                : kind === "pet"
                  ? m.shareBoxPlaceholderPet
                  : m.shareBoxPlaceholderInsignia
          }
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <button
          type="button"
          disabled={!draft.trim() || busy !== null}
          onClick={() => void handleImport()}
        >
          {busy === "import" ? m.importing : m.importApply}
        </button>
        {lastExported ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void copyText(lastExported).then((ok) => {
                onStatus(
                  ok ? m.copiedAgain(lastExported.length) : m.copyManually,
                );
                setDraft(lastExported);
              });
            }}
          >
            {m.recopyLast}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type ProfileSchemeShareBoxProps = {
  canExportCircuit: boolean;
  canExportInsignia: boolean;
  onExportCircuit: () => Promise<string>;
  onExportInsignia: () => Promise<string>;
  canExportDeck?: boolean;
  onExportDeck?: () => Promise<string>;
  canExportPet?: boolean;
  onExportPet?: () => Promise<string>;
  onImport: (code: string) => Promise<void>;
  onStatus: (msg: string) => void;
};

/** Import / export circuit + insignia + deck + pet schemes onto the current character profile. */
export function ProfileSchemeShareBox({
  canExportCircuit,
  canExportInsignia,
  onExportCircuit,
  onExportInsignia,
  canExportDeck = false,
  onExportDeck,
  canExportPet = false,
  onExportPet,
  onImport,
  onStatus,
}: ProfileSchemeShareBoxProps) {
  const { m } = useI18n();
  const [draft, setDraft] = useState("");
  const [lastExported, setLastExported] = useState("");
  const [busy, setBusy] = useState<
    "circuit" | "insignia" | "deck" | "pet" | "import" | null
  >(null);

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function handleExport(
    kind: "circuit" | "insignia" | "deck" | "pet",
    run: () => Promise<string>,
  ): Promise<void> {
    if (busy) return;
    setBusy(kind);
    try {
      const code = await run();
      setLastExported(code);
      setDraft(code);
      const copied = await copyText(code);
      const label =
        kind === "circuit"
          ? m.circuitSchemeWord
          : kind === "deck"
            ? m.deckSchemeWord
            : m.insigniaSchemeWord;
      onStatus(
        copied
          ? m.copiedProfileKind(label, code.length)
          : m.generatedProfileKind(label, code.length),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : m.exportFail;
      onStatus(message);
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(): Promise<void> {
    const code = draft.trim();
    if (!code || busy) return;
    const found = peekSchemeShareKind(code);
    if (!found) {
      onStatus(m.badSchemeCode);
      return;
    }
    setBusy("import");
    try {
      await onImport(code);
      setDraft("");
    } catch (err) {
      const message = err instanceof Error ? err.message : m.importFail;
      onStatus(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="scheme-share">
      <div className="scheme-share-head">
        <h3 className="section-title" style={{ margin: 0 }}>
          {m.applyShareScheme}
        </h3>
        <div className="scheme-share-exports">
          <button
            type="button"
            className="secondary"
            disabled={!canExportCircuit || busy !== null}
            title={
              canExportCircuit ? m.exportCircuitTitle : m.noCircuitOnThis
            }
            onClick={() => void handleExport("circuit", onExportCircuit)}
          >
            {busy === "circuit" ? m.exporting : m.exportCircuit}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!canExportInsignia || busy !== null}
            title={
              canExportInsignia ? m.exportInsigniaTitle : m.noInsigniaOnThis
            }
            onClick={() => void handleExport("insignia", onExportInsignia)}
          >
            {busy === "insignia" ? m.exporting : m.exportInsignia}
          </button>
          {onExportDeck ? (
            <button
              type="button"
              className="secondary"
              disabled={!canExportDeck || busy !== null}
              title={canExportDeck ? m.exportDeckTitle : m.noDeckOnThis}
              onClick={() => void handleExport("deck", onExportDeck)}
            >
              {busy === "deck" ? m.exporting : m.exportDeck}
            </button>
          ) : null}
          {onExportPet ? (
            <button
              type="button"
              className="secondary"
              disabled={!canExportPet || busy !== null}
              title={canExportPet ? m.exportPetTitle : m.noPetOnThis}
              onClick={() => void handleExport("pet", onExportPet)}
            >
              {busy === "pet" ? m.exporting : m.exportPet}
            </button>
          ) : null}
        </div>
      </div>
      <p className="muted small">{m.profileShareHint}</p>
      <label>
        {m.schemeString}
        <textarea
          className="scheme-share-input"
          rows={3}
          spellCheck={false}
          value={draft}
          placeholder={m.profileSharePlaceholder}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <button
          type="button"
          disabled={!draft.trim() || busy !== null}
          onClick={() => void handleImport()}
        >
          {busy === "import" ? m.applying : m.importApplyProfile}
        </button>
        {lastExported ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void copyText(lastExported).then((ok) => {
                onStatus(
                  ok ? m.copiedAgain(lastExported.length) : m.copyManually,
                );
                setDraft(lastExported);
              });
            }}
          >
            {m.recopyLast}
          </button>
        ) : null}
      </div>
    </div>
  );
}
