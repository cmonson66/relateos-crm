'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, useMap } from 'react-leaflet';

export type Fix = { lat: number; lng: number; accuracy: number };

/**
 * Where the rep is standing.
 *
 * watchPosition rather than a one-shot read, because the useful case is a rep
 * driving a territory with the map open - a single fix goes stale the moment
 * they pull away from the curb.
 *
 * Nothing is requested until the rep asks. A permission prompt on page load
 * gets denied on reflex, and a denial is sticky per origin, so asking at the
 * wrong moment costs the feature permanently.
 */

const CONSENT_KEY = 'np:geoOk';

/**
 * Has this rep already allowed location here?
 *
 * Used to decide whether the map may locate itself on load. A cold prompt on
 * page load gets denied on reflex and the denial is sticky per origin, so the
 * first request always comes from a deliberate tap; after that it is
 * remembered and the map can open where the rep is standing.
 */
export function hasLocationConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberConsent() {
  try {
    window.localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    // private mode - the rep taps Near me each visit, which still works
  }
}

export function useMyLocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('This device cannot share a location');
      return;
    }
    setError(null);
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        rememberConsent();
        setError(null);
      },
      (err) => {
        // A denial is permanent until the browser setting is changed, so say
        // that plainly rather than leaving a spinner running.
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location is blocked for this site. Turn it on in your browser settings for crm.nectarpayaz.com.'
            : 'Could not get a location fix. Try again outdoors.',
        );
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }, []);

  useEffect(() => stop, [stop]);

  return { fix, error, watching, start, stop };
}

/** Recentres when a fix first arrives, and whenever the rep taps the control. */
export function FollowMe({
  fix,
  signal,
  radiusMiles,
}: {
  fix: Fix | null;
  signal: number;
  radiusMiles?: number | null;
}) {
  const map = useMap();
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (!fix) return;

    // Re-frame when the rep asks (signal) or changes the radius, never on
    // every GPS tick - following each update would yank the map out from
    // under someone reading a popup.
    const key = `${signal}:${radiusMiles ?? 'none'}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (!radiusMiles) {
      map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }

    // Fit the circle the chips describe, so 1 mile and 10 miles actually look
    // different. A degree of latitude is ~69 miles; longitude shrinks with
    // latitude, which matters at Phoenix's 33 degrees.
    const dLat = radiusMiles / 69;
    const dLng = radiusMiles / (69 * Math.cos((fix.lat * Math.PI) / 180));
    map.fitBounds(
      [
        [fix.lat - dLat, fix.lng - dLng],
        [fix.lat + dLat, fix.lng + dLng],
      ],
      { padding: [24, 24], animate: true },
    );
  }, [fix, signal, radiusMiles, map]);

  return null;
}

/** The blue dot, with a ring showing how sure the phone actually is. */
export function MyLocationMarker({ fix }: { fix: Fix | null }) {
  if (!fix) return null;
  return (
    <>
      {/* Only drawn when the fix is vague enough to matter - a 5m ring is
          noise, a 300m ring is the difference between two shops. */}
      {fix.accuracy > 40 && (
        <Circle
          center={[fix.lat, fix.lng]}
          radius={fix.accuracy}
          pathOptions={{
            color: '#2563eb',
            weight: 1,
            opacity: 0.5,
            fillColor: '#2563eb',
            fillOpacity: 0.1,
          }}
        />
      )}
      <CircleMarker
        center={[fix.lat, fix.lng]}
        radius={7}
        pathOptions={{
          color: '#ffffff',
          weight: 2.5,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }}
      />
    </>
  );
}

/** Straight-line miles, good enough for sorting nearby shops. */
export function milesBetween(a: Fix, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
