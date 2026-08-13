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
export function FollowMe({ fix, signal }: { fix: Fix | null; signal: number }) {
  const map = useMap();
  const centredFor = useRef<number>(-1);

  useEffect(() => {
    if (!fix) return;
    // Recentre on the first fix, then only when asked. Following every GPS
    // update would yank the map out from under a rep reading a popup.
    if (centredFor.current === signal) return;
    centredFor.current = signal;
    map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [fix, signal, map]);

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
