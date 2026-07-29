'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { verticalLabel } from '@/lib/verticals';
import type { MapAccount } from './map-view';

const BAND_COLOR: Record<string, string> = {
  HOT: '#EF4444',
  WARM: '#F59E0B',
  COOL: '#64748B',
};

// Phoenix fallback center
const DEFAULT_CENTER: [number, number] = [33.4484, -112.074];

function FitBounds({ accounts, fitSignal }: { accounts: MapAccount[]; fitSignal: number }) {
  const map = useMap();
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (accounts.length === 0) return;
    // Fit on first load, then ONLY when the user asks (Fit view button).
    // Filter toggles keep the current viewport instead of re-zooming.
    if (fittedOnce.current && fitSignal === 0) return;
    fittedOnce.current = true;
    const lats = accounts.map(a => a.lat);
    const lngs = accounts.map(a => a.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [40, 40], maxZoom: 14 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal, map]);
  return null;
}

export default function LeafletMap({ accounts, fitSignal = 0 }: { accounts: MapAccount[]; fitSignal?: number }) {
  return (
    <div className="h-[70vh] rounded-md overflow-hidden border border-border/40">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={10}
        preferCanvas
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: '#111' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds accounts={accounts} fitSignal={fitSignal} />
        {accounts.map(a => (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lng]}
            radius={a.band === 'HOT' ? 9 : a.band === 'WARM' ? 7 : 5}
            pathOptions={{
              color: BAND_COLOR[a.band] ?? BAND_COLOR.COOL,
              fillColor: BAND_COLOR[a.band] ?? BAND_COLOR.COOL,
              fillOpacity: 0.75,
              weight: 1.5,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {verticalLabel(a.vertical)} · {a.band}
                  {a.city ? ` · ${a.city}` : ''}
                </div>
                {a.contactName && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>👤 {a.contactName}</div>
                )}
                {a.phone && (
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    <a href={`tel:${a.phone}`}>{a.phone}</a>
                  </div>
                )}
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions ↗
                  </a>
                  {' · '}
                  <Link href={`/accounts/${a.id}`}>Open account →</Link>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
