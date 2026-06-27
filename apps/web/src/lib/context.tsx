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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<DeviceIdentity | null>(() => loadIdentity());
  // The api reads identity through a ref so a single instance always sees the latest value.
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const api = useMemo(() => createApi(() => identityRef.current), []);

  const value = useMemo<AppContextValue>(
    () => ({
      identity,
      api,
      setIdentity: (id) => {
        saveIdentity(id);
        setIdentityState(id);
      },
      signOut: () => {
        clearStored();
        setIdentityState(null);
      },
    }),
    [identity, api],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
