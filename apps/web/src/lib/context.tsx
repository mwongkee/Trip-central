import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Api } from './api.js';
import { createApi } from './api.js';
import {
  loadIdentity,
  saveIdentity,
  clearIdentity as clearStored,
  type DeviceIdentity,
} from './identity.js';

interface AppContextValue {
  identity: DeviceIdentity | null;
  setIdentity: (id: DeviceIdentity) => void;
  signOut: () => void;
  api: Api;
  /** Per-device "noped"/hidden place ids (localStorage; never written to the server). */
  hidden: Set<string>;
  hide: (id: string) => void;
  unhide: (id: string) => void;
  unhideAll: () => void;
}

const HIDDEN_KEY = 'tripboard.hidden.v1';

function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<DeviceIdentity | null>(() => loadIdentity());
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden());
  // The api reads identity through a ref so a single instance always sees the latest value.
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const api = useMemo(() => createApi(() => identityRef.current), []);

  function persistHidden(next: Set<string>) {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore (private mode) */
    }
    setHidden(next);
  }

  const value = useMemo<AppContextValue>(
    () => ({
      identity,
      api,
      hidden,
      hide: (id) => persistHidden(new Set(hidden).add(id)),
      unhide: (id) => {
        const next = new Set(hidden);
        next.delete(id);
        persistHidden(next);
      },
      unhideAll: () => persistHidden(new Set()),
      setIdentity: (id) => {
        saveIdentity(id);
        setIdentityState(id);
      },
      signOut: () => {
        clearStored();
        setIdentityState(null);
      },
    }),
    [identity, api, hidden],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
