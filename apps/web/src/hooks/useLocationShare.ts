import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context.js';

/**
 * Live location sharing with the family — battery-conscious and resilient to the
 * app being backgrounded.
 *
 * Battery: uses a COARSE fix (`enableHighAccuracy: false` → wifi/cell, not GPS),
 * reuses cached fixes (`maximumAge`), and only posts when you've actually moved
 * (≥ MIN_MOVE_M) or to refresh the server TTL every HEARTBEAT_MS. That's plenty
 * to answer "where's everyone?" without hammering the GPS or the network.
 *
 * Background: browsers PAUSE geolocation when the page isn't visible (tab hidden
 * / phone locked) — there is no true background geolocation on the web. So we do
 * the next best thing: persist the on/off choice and auto-resume the moment the
 * app is reopened, flush the latest fix right before we get suspended, and
 * refresh immediately on return. Your last spot stays visible to others until
 * the 1-hour server TTL expires. Opt-in only; turning it off removes you.
 */

const SHARE_KEY = 'tripboard.sharing.v1';
const HEARTBEAT_MS = 90_000; // refresh presence at least this often (keeps the TTL fresh)
const MIN_MOVE_M = 30; // only post a new fix after moving this far (saves battery + network)
const GEO_OPTS: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 };

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useLocationShare() {
  const { api } = useApp();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const heartbeat = useRef<number | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null); // latest fix seen
  const lastSent = useRef<{ lat: number; lng: number; t: number } | null>(null); // last fix posted

  /** Post the latest fix if we've moved enough or the heartbeat is due (or forced). */
  const push = useCallback(
    (force = false) => {
      const p = lastPos.current;
      if (!p) return;
      const prev = lastSent.current;
      const moved = !prev || metersBetween(prev, p) >= MIN_MOVE_M;
      const stale = !prev || Date.now() - prev.t >= HEARTBEAT_MS;
      if (!force && !moved && !stale) return;
      lastSent.current = { lat: p.lat, lng: p.lng, t: Date.now() };
      void api.sharePresence(p.lat, p.lng).catch(() => {});
    },
    [api],
  );

  const endWatch = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (heartbeat.current != null) {
      clearInterval(heartbeat.current);
      heartbeat.current = null;
    }
  }, []);

  const beginWatch = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (watchId.current == null) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          push();
        },
        () => {},
        GEO_OPTS,
      );
    }
    if (heartbeat.current == null) {
      heartbeat.current = window.setInterval(() => push(), HEARTBEAT_MS);
    }
  }, [push]);

  const stopInternal = useCallback(() => {
    endWatch();
    setSharing(false);
    try {
      localStorage.removeItem(SHARE_KEY);
    } catch {
      /* ignore (private mode) */
    }
  }, [endWatch]);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setError(null);
    setSharing(true);
    try {
      localStorage.setItem(SHARE_KEY, '1');
    } catch {
      /* ignore */
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        push(true);
        beginWatch();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission denied — enable it in your browser to share your spot.');
          stopInternal();
        } else {
          // Couldn't get an instant fix; keep watching — it may acquire one shortly.
          setError('Getting your location…');
          beginWatch();
        }
      },
      GEO_OPTS,
    );
  }, [push, beginWatch, stopInternal]);

  const stop = useCallback(() => {
    stopInternal();
    void api.stopPresence().catch(() => {});
  }, [stopInternal, api]);

  const toggle = useCallback(() => {
    if (sharing) stop();
    else start();
  }, [sharing, start, stop]);

  // Background handling: flush our latest spot before suspension; resume + refresh on return.
  useEffect(() => {
    if (!sharing) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        push(true);
      } else {
        beginWatch();
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              push(true);
            },
            () => {},
            GEO_OPTS,
          );
        }
      }
    };
    const onPageHide = () => push(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [sharing, push, beginWatch]);

  // Auto-resume across reloads / app reopens if sharing was left on (closest thing
  // to "running in the background" the web allows). Stop only the timers on unmount —
  // leave the server presence so others still see your last spot until the TTL.
  useEffect(() => {
    let wasOn = false;
    try {
      wasOn = localStorage.getItem(SHARE_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (wasOn) start();
    return () => endWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sharing, toggle, error };
}
