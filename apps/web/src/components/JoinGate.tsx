import { useState } from 'react';
import type { TripBundle } from '@tripboard/shared';
import { useApp } from '../lib/context.js';

/**
 * First-run gate: a family member joins by tapping who they are (claims a seeded
 * adult) or typing a new name. The choice is stored on this device so they don't
 * sign in again.
 */
export function JoinGate({ bundle }: { bundle: TripBundle }) {
  const { api, setIdentity } = useApp();
  const [name, setName] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group seeded adults by family for the quick-pick list.
  const families = new Map<string, { familyName: string; adults: { userId: string; name: string }[] }>();
  for (const m of bundle.members) {
    if (!families.has(m.familyId)) families.set(m.familyId, { familyName: m.familyName, adults: [] });
    families.get(m.familyId)!.adults.push({ userId: m.userId, name: m.name });
  }

  async function join(opts: { name: string; userId?: string; familyId?: string }) {
    setBusy(true);
    setError(null);
    try {
      const member = await api.join({ name: opts.name, userId: opts.userId, familyId: opts.familyId });
      setIdentity({ userId: member.userId, name: member.name, familyId: member.familyId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
      setBusy(false);
    }
  }

  return (
    <main className="join">
      <div className="join__card">
        <h1>{bundle.trip.name}</h1>
        <p className="join__lead">Join the trip — who are you?</p>

        <div className="join__families">
          {[...families.entries()].map(([fid, fam]) => (
            <section key={fid} className="join__family">
              <h2>{fam.familyName}</h2>
              <div className="join__people">
                {fam.adults.map((a) => (
                  <button
                    key={a.userId}
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => join({ name: a.name, userId: a.userId, familyId: fid })}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <form
          className="join__new"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) join({ name: name.trim(), familyId: familyId || undefined });
          }}
        >
          <h2>Or join as someone new</h2>
          <label htmlFor="join-name">Your name</label>
          <input
            id="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grandma"
            autoComplete="name"
          />
          <label htmlFor="join-family">Family (optional)</label>
          <select id="join-family" value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
            <option value="">— pick a family —</option>
            {[...families.entries()].map(([fid, fam]) => (
              <option key={fid} value={fid}>
                {fam.familyName}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={busy || !name.trim()}>
            Join trip
          </button>
        </form>

        {error && (
          <p role="alert" className="join__error">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
