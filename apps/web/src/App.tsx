import { useApp } from './lib/context.js';
import { useBundle } from './hooks/queries.js';
import { JoinGate } from './components/JoinGate.js';
import { Board } from './components/Board.js';

export function App() {
  const { identity, signOut, api } = useApp();
  const bundle = useBundle();

  if (bundle.isLoading) return <main className="loading">Loading trip…</main>;
  if (bundle.isError || !bundle.data) {
    return (
      <main className="loading" role="alert">
        Could not load the trip. {(bundle.error as Error | undefined)?.message}
      </main>
    );
  }

  if (!identity) return <JoinGate bundle={bundle.data} />;

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__brand">TripBoard</h1>
          <p className="app__trip">{bundle.data.trip.name}</p>
        </div>
        <div className="app__who">
          <span>
            Hi, <strong>{identity.name}</strong>
          </span>
          {api.mode === 'local' && api.reset && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (confirm('Reset the demo data on this device?')) {
                  api.reset?.();
                  location.reload();
                }
              }}
            >
              Reset demo
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            Switch user
          </button>
        </div>
      </header>
      <Board bundle={bundle.data} />
      <footer className="app__footer">
        <small>
          {api.mode === 'local'
            ? 'Local demo mode — data is stored on this device.'
            : 'Connected to the trip API.'}
        </small>
      </footer>
    </div>
  );
}
