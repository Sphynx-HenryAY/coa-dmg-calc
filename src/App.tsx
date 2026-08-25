import "./App.css";
import demoData from "./data/demoData.json";
import { resources, SUPPORTED_LOCALES } from "./lib/i18n";
import { useI18n } from "./lib/I18nProvider";
import { AppStoreProvider, useAppStore, type Tab } from "./store/AppStore";
import { CircuitTab } from "./components/CircuitTab";
import { InsigniaTab } from "./components/InsigniaTab";
import { ProfessionTab } from "./components/ProfessionTab";
import { LanguageTab } from "./components/LanguageTab";
import { ProfilesTab } from "./components/ProfilesTab";
import { GearItemsTab } from "./components/GearItemsTab";
import { CompareTab } from "./components/CompareTab";

function Shell(): React.JSX.Element {
  const { locale, setLocale, m } = useI18n();
  const {
    ready,
    tab,
    setTab,
    addProfile,
    exportAll,
    importAll,
  } = useAppStore();

  if (!ready) {
    return (
      <div className="app-shell">
        <p>{m.loading}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <div className="hero-title-row">
            <h1>{m.appTitle}</h1>
            <div className="lang-switch" role="group" aria-label={m.langAria}>
              {SUPPORTED_LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={locale === loc ? "active" : ""}
                  onClick={() => setLocale(loc)}
                >
                  {resources[loc].meta.label}
                </button>
              ))}
            </div>
          </div>
          <p>{m.appSubtitle}</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={addProfile}>
            {m.addProfile}
          </button>
          <button type="button" className="secondary" onClick={exportAll}>
            {m.exportJson}
          </button>
          <label className="file-button">
            {m.importJson}
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importAll(f);
              }}
            />
          </label>
        </div>
      </header>

      <nav className="tabs" aria-label={m.tabsAria}>
        {(
          [
            ["profiles", m.tabProfiles, m.tabProfilesShort],
            ["gear", m.tabGear, m.tabGearShort],
            ["circuits", m.tabCircuits, m.tabCircuitsShort],
            ["insignias", m.tabInsignias, m.tabInsigniasShort],
            ["professions", m.tabProfessions, m.tabProfessionsShort],
            ["compare", m.tabCompare, m.tabCompareShort],
            ["languages", m.tabLanguages, m.tabLanguagesShort],
          ] as const
        ).map(([id, label, shortLabel]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id as Tab)}
            aria-current={tab === id ? "page" : undefined}
          >
            <span className="tab-label-full">{label}</span>
            <span className="tab-label-short">{shortLabel}</span>
          </button>
        ))}
      </nav>

      {tab === "profiles" && <ProfilesTab />}
      {tab === "gear" && <GearItemsTab />}
      {tab === "circuits" && <CircuitTab />}
      {tab === "insignias" && <InsigniaTab />}
      {tab === "professions" && <ProfessionTab />}
      {tab === "languages" && <LanguageTab />}
      {tab === "compare" && <CompareTab />}

      <footer className="footer muted small">
        {m.footer(demoData.equipment.length)}
      </footer>
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <AppStoreProvider>
      <Shell />
    </AppStoreProvider>
  );
}
