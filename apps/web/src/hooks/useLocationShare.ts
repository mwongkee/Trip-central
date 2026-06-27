import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context.js';

/**
 * Live location sharing: when on, watches the device position and posts it to the
 * trip every ~30s so the rest of the family sees you on the map. Turning it off
 * (or the 1-hour TTL) removes you. Opt-in only.
 */
export function useLocationShare() {
  const { api } = useApp();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<number | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  function clearTimers() {
    if (watchId.current != null && typeof navigator !== 'undefined') navigator.geolocation.clearWatch(watchId.current);
    if (intervalId.current != null) clearInterval(intervalId.current);
    watchId.current = null;
    intervalId.current = null;
  }

  function stop() {
    clearTimers();
    setSharing(false);
    void api.stopPresence().catch(() => {});
  }

  function start() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        void api.sharePresence(lastPos.current.lat, lastPos.current.lng);
        setSharing(true);
      },
      () => setError('Could not get your location — check location permissions.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    intervalId.current = window.setInterval(() => {
      if (lastPos.current) void api.sharePresence(lastPos.current.lat, lastPos.current.lng);
    }, 30_000);
  }

  function toggle() {
    if (sharing) stop();
    else start();
  }

  useEffect(() => () => clearTimers(), []);

  return { sharing, toggle, error };
}
