import { useState } from 'react';
import { useApp } from './lib/context.js';
import { useBundle } from './hooks/queries.js';
import { JoinGate } from './components/JoinGate.js';
import { Board } from './components/Board.js';
import { Avatar } from './components/Avatar.js';
import { Help } from './components/Help.js';
import { HiddenSheet } from './components/HiddenSheet.js';

export function App() {
  const { identity, signOut, api, hidden } = useApp();
  const bundle = useBundle();
  const [showHelp, setShowHelp] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (bundle.isLoading)
    return (
      <main className="loading">
        <span className="spinner" aria-hidden="true" /> Loading trip…
      </main>
    );
  if (bundle.isError || !bundle.data) {
    return (
      <main className="loading" role="alert">
        Could not load the trip. {(bundle.error as Error | undefined)?.message}
      </main>
    );
  }

  if (!identity) return <JoinGate bundle={bundle.data} />;

  const familyName =
    bundle.data.members.find((m) => m.familyId === identity.familyId)?.familyName ?? null;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brandwrap">
          <span className="app__brand">TripBoard</span>
          <span className="app__trip">{bundle.data.trip.name}{familyName ? ` · ${identity.name}` : ''}</span>
        </div>
        <div className="app__who">
          <Avatar name={identity.name} size={26} />
          <div className="menu">
            <button
              type="button"
              className="btn btn--ghost menu__btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div className="menu__backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu__list" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setShowHelp(true); setMenuOpen(false); }}>❔ Help</button>
                  {hidden.size > 0 && (
                    <button type="button" role="menuitem" onClick={() => { setShowHidden(true); setMenuOpen(false); }}>🙈 Hidden places ({hidden.size})</button>
                  )}
                  {api.mode === 'local' && api.reset && (
                    <button type="button" role="menuitem" onClick={() => { if (confirm('Reset the demo data on this device?')) { api.reset?.(); location.reload(); } }}>🔄 Reset demo</button>
                  )}
                  <button type="button" role="menuitem" onClick={() => { signOut(); setMenuOpen(false); }}>↩ Switch user</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
      {showHidden && <HiddenSheet items={bundle.data.items} onClose={() => setShowHidden(false)} />}
      <Board bundle={bundle.data} />
    </div>
  );
}
