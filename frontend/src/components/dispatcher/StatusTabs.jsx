export default function StatusTabs({ tabs, tab, setTab }) {
  return (
    <div className="fp-tabs">
      {tabs.map((t) => (
        <button
          key={t}
          className={`fp-tab ${tab === t ? "fp-tab-active" : ""}`}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
