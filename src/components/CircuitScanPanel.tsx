import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CircuitKind } from "../lib/types";
import {
  hasParseableCircuit,
  parseCircuitText,
  parseResultLines,
  type CircuitParseResult,
} from "../lib/circuitParse";
import { m as i18nMsg } from "../lib/i18n";
import { useI18n } from "../lib/I18nProvider";

type CircuitScanPanelProps = {
  kindHint: CircuitKind;
  onApplyToForm: (result: CircuitParseResult) => void;
  onAddDirectly: (result: CircuitParseResult) => void;
  onStatus: (msg: string) => void;
};

export function CircuitScanPanel({
  kindHint,
  onApplyToForm,
  onAddDirectly,
  onStatus,
}: CircuitScanPanelProps) {
  const { m } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [text, setText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string>("");

  const result = useMemo(
    () => parseCircuitText(text, { kindHint }),
    [text, kindHint],
  );

  const replacePreview = useCallback((next: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next;
    setPreviewUrl(next);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const runOcr = useCallback(
    async (file: Blob) => {
      setBusy(true);
      setError("");
      setProgress(m.ocrPrepare);
      if (file.type.startsWith("image/")) {
        replacePreview(URL.createObjectURL(file));
      }
      try {
        const { recognizeCircuitImage } = await import("../lib/circuitOcr");
        const recognized = await recognizeCircuitImage(file, (info) => {
          const pct = Math.round((info.progress || 0) * 100);
          const label =
            info.status === "loading tesseract core"
              ? m.ocrLoadEngine
              : info.status === "initializing tesseract"
                ? m.ocrInitEngine
                : info.status === "loading language traineddata"
                  ? m.ocrDownloadLang
                  : info.status === "initializing api"
                    ? m.ocrInitApi
                    : m.ocrRecognize;
          setProgress(m.ocrProgress(label, pct));
        });
        setText(recognized);
        const parsed = parseCircuitText(recognized, { kindHint });
        if (hasParseableCircuit(parsed)) {
          onStatus(m.ocrHits(parsed.hits.length));
        } else {
          onStatus(m.ocrNoHits);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(m.ocrFail(message));
      } finally {
        setBusy(false);
        setProgress("");
      }
    },
    [kindHint, onStatus, replacePreview, m],
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          (target.tagName === "TEXTAREA" && !target.closest(".circuit-scan")));
      const image = firstClipboardImage(e.clipboardData);
      if (image) {
        if (inField) return;
        e.preventDefault();
        void runOcr(image);
        return;
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [runOcr]);

  function onFiles(files: FileList | File[] | null): void {
    const file = files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      void runOcr(file);
      return;
    }
    if (file.type.startsWith("text/") || /\.(txt|csv)$/i.test(file.name)) {
      void file.text().then((value) => {
        setText(value);
        replacePreview(null);
      });
    }
  }

  const canUse = hasParseableCircuit(result);

  return (
    <div
      className={`circuit-scan ${dragOver ? "dragover" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <div className="circuit-scan-head">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          {m.scanTitle}
        </h3>
        <p className="muted small">{m.scanHint}</p>
      </div>

      <div className="circuit-scan-actions">
        <label className="file-button">
          {m.pickScreenshot}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,text/plain"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void pasteFromClipboard(runOcr, setText, setError)}
        >
          {m.pasteClipboard}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            setText("");
            setError("");
            replacePreview(null);
          }}
        >
          {m.clear}
        </button>
      </div>

      {previewUrl ? (
        <img className="circuit-scan-thumb" src={previewUrl} alt={m.scanAlt} />
      ) : null}

      <label>
        {m.scanTextLabel}
        <textarea
          value={text}
          placeholder={m.scanPlaceholder}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
      </label>

      {busy ? <p className="muted small">{progress || m.scanning}</p> : null}
      {error ? <p className="scan-error">{error}</p> : null}

      {text.trim() ? (
        <div className="circuit-scan-result">
          {canUse ? (
            <ul className="stat-lines">
              {parseResultLines(result).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{m.noStatsYet}</p>
          )}
          {result.warnings.map((w) => (
            <p key={w} className="muted small">
              {w}
            </p>
          ))}
          <div className="form-actions">
            <button
              type="button"
              disabled={!canUse || busy}
              onClick={() => onApplyToForm(result)}
            >
              {m.fillForm}
            </button>
            <button
              type="button"
              disabled={!canUse || busy}
              onClick={() => onAddDirectly(result)}
            >
              {m.addCircuitDirect}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function firstClipboardImage(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}

async function pasteFromClipboard(
  runOcr: (file: Blob) => Promise<void>,
  setText: (text: string) => void,
  setError: (msg: string) => void,
): Promise<void> {
  try {
    if (!navigator.clipboard?.read) {
      setError(i18nMsg().clipboardBlocked);
      return;
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        await runOcr(blob);
        return;
      }
      if (item.types.includes("text/plain")) {
        const blob = await item.getType("text/plain");
        setText(await blob.text());
        return;
      }
    }
    setError(i18nMsg().clipboardEmpty);
  } catch {
    setError(i18nMsg().clipboardDenied);
  }
}
