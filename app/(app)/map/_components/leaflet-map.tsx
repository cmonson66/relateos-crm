'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { FollowMe, MyLocationMarker, type Fix } from './my-location';
import type { CircleMarker as LeafletCircleMarkerType } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { verticalLabel } from '@/lib/verticals';
import type { MapAccount } from './map-view';
import CryptoHeat from './crypto-heat';
import {
  ATM_COLOR,
  MERCHANT_COLOR,
  formatDistance,
  type CryptoSignal,
  type CryptoStats,
} from '@/lib/crypto/density';

const BAND_COLOR: Record<string, string> = {
  HOT: '#EF4444',
  WARM: '#F59E0B',
  COOL: '#64748B',
};

// Phoenix fallback center
const DEFAULT_CENTER: [number, number] = [33.4484, -112.074];

// Standard OSM tiles are too saturated for a heat layer to read on top of.
// While the overlay is on we swap to CARTO dark matter, which is also free
// and keyless and matches the app's dark theme better anyway.
const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  quiet: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

function FitBounds({ accounts, fitSignal, hasFocus }: { accounts: MapAccount[]; fitSignal: number; hasFocus: boolean }) {
  const map = useMap();
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (accounts.length === 0) return;
    // A ?focus= arrival owns the initial view; auto-fit would fight it.
    // The Fit view button still works normally afterwards.
    if (hasFocus && fitSignal === 0) {
      fittedOnce.current = true;
      return;
    }
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

function FocusView({
  account,
  markerRefs,
}: {
  account: MapAccount | null;
  markerRefs: React.RefObject<Map<string, LeafletCircleMarkerType>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!account) return;
    map.setView([account.lat, account.lng], 16, { animate: true });
    // Marker mounts in the same commit; open its popup once Leaflet settles.
    const t = setTimeout(() => {
      markerRefs.current?.get(account.id)?.openPopup();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, map]);
  return null;
}

export default function LeafletMap({
  accounts,
  focusId = null,
  fitSignal = 0,
  signals = [],
  showHeat = false,
  heatFilter = 'all',
  cryptoStats,
  myFix = null,
  followSignal = 0,
}: {
  accounts: MapAccount[];
  focusId?: string | null;
  fitSignal?: number;
  signals?: CryptoSignal[];
  showHeat?: boolean;
  heatFilter?: 'all' | 'atm' | 'merchant';
  cryptoStats?: Map<string, CryptoStats>;
  myFix?: Fix | null;
  followSignal?: number;
}) {
  const shownSignals = showHeat
    ? signals.filter(s => heatFilter === 'all' || s.signal_type === heatFilter)
    : [];

  const markerRefs = useRef<Map<string, LeafletCircleMarkerType>>(new Map());
  const focusAccount = focusId ? accounts.find(a => a.id === focusId) ?? null : null;

  const tiles = showHeat ? TILES.quiet : TILES.street;
  const atmCount = shownSignals.filter(s => s.signal_type === 'atm').length;

  return (
    <div className="relative h-[70vh] rounded-md overflow-hidden border border-border/40">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={10}
        preferCanvas
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: '#111' }}
      >
        {/* key forces a clean tile swap when the overlay toggles */}
        <TileLayer key={showHeat ? 'quiet' : 'street'} attribution={tiles.attribution} url={tiles.url} />

        <CryptoHeat signals={shownSignals} visible={showHeat} />

        <FitBounds accounts={accounts} fitSignal={fitSignal} hasFocus={!!focusAccount || !!myFix} />
        <FollowMe fix={myFix} signal={followSignal} />
        <MyLocationMarker fix={myFix} />
        <FocusView account={focusAccount} markerRefs={markerRefs} />

        {/* Kiosks render BEFORE accounts on purpose: the canvas renderer
            hit-tests in reverse draw order, so drawing accounts last keeps a
            lead clickable even when a kiosk pin overlaps it. */}
        {shownSignals.map(s => {
          const isAtm = s.signal_type === 'atm';
          return (
            <CircleMarker
              key={`sig-${s.id}`}
              center={[s.lat, s.lng]}
              radius={isAtm ? 4 : 5}
              pathOptions={{
                color: '#ffffff',
                weight: 1.5,
                fillColor: isAtm ? ATM_COLOR : MERCHANT_COLOR,
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontWeight: 700 }}>{s.brand || s.name || 'Crypto location'}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {isAtm ? 'Crypto ATM' : 'Accepts crypto'}
                    {s.city ? ` · ${s.city}` : ''}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {accounts.map(a => {
          const cs = cryptoStats?.get(a.id);
          return (
            <CircleMarker
              key={a.id}
              ref={(m) => {
                if (m) markerRefs.current.set(a.id, m);
                else markerRefs.current.delete(a.id);
              }}
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

                  {showHeat && cs && (
                    <div
                      style={{
                        marginTop: 7,
                        paddingTop: 6,
                        borderTop: '1px solid rgba(0,0,0,0.12)',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ opacity: 0.75 }}>Crypto density</span>
                        <strong>{cs.score}/100</strong>
                      </div>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          background: 'rgba(0,0,0,0.12)',
                          margin: '5px 0 4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${cs.score}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, #7b2fbe, ${ATM_COLOR})`,
                          }}
                        />
                      </div>
                      <div style={{ opacity: 0.75 }}>
                        {cs.atmCount} ATM{cs.atmCount === 1 ? '' : 's'}
                        {cs.merchantCount > 0 ? ` · ${cs.merchantCount} accepting` : ''} within 1.5 mi
                        {cs.nearestAtmM !== null ? ` · nearest ${formatDistance(cs.nearestAtmM)}` : ''}
                      </div>
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
                    <Link href={`/call/${a.id}`} style={{ marginRight: 10 }}>📞 Call mode</Link>
                    <Link href={`/appointments/new?account=${a.id}`} style={{ marginRight: 10 }}>📅 Schedule</Link>
                    <Link href={`/accounts/${a.id}`}>Open account →</Link>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      </MapContainer>

      {showHeat && (
        <div className="pointer-events-none absolute left-3 bottom-6 z-[500] rounded-md border border-border/40 bg-card/90 backdrop-blur px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
            Crypto density
          </div>
          <div
            className="h-2 w-40 rounded-full"
            style={{ background: 'linear-gradient(90deg,#2a1550,#3b1d6e,#7b2fbe,#b93fd0,#e85ac0,#ff7ad9)' }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 mb-2">
            <span>sparse</span>
            <span>dense corridor</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: ATM_COLOR }} />
            ATM
            <span className="font-mono text-foreground">{atmCount}</span>
            <span className="h-2 w-2 rounded-full ml-2" style={{ background: MERCHANT_COLOR }} />
            Accepting
            <span className="font-mono text-foreground">{shownSignals.length - atmCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
