'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { HEAT_GRADIENT, type CryptoSignal } from '@/lib/crypto/density';

export const HEAT_PANE = 'cryptoHeatPane';

type Props = {
  signals: CryptoSignal[];
  visible: boolean;
  radius?: number;
};

export default function CryptoHeat({ signals, visible, radius = 34 }: Props) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const [pluginReady, setPluginReady] = useState(false);

  // leaflet.heat is an old-style plugin: it assigns onto a global `L` rather
  // than importing it. Under a bundler that global doesn't exist, so we set
  // it first and load the plugin after. If it fails we simply never render
  // heat — the rest of the map is untouched.
  useEffect(() => {
    let cancelled = false;
    (window as unknown as { L: typeof L }).L = L;
    import('leaflet.heat')
      .then(() => {
        if (!cancelled) setPluginReady(true);
      })
      .catch(err => {
        console.error('leaflet.heat failed to load — heat layer disabled', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dedicated pane under the overlay pane (400) where the band markers live,
  // with pointer events off so it can never swallow a popup click.
  useEffect(() => {
    if (!map.getPane(HEAT_PANE)) {
      const pane = map.createPane(HEAT_PANE);
      pane.style.zIndex = '350';
      pane.style.pointerEvents = 'none';
    }
  }, [map]);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!pluginReady || !visible || signals.length === 0) return;

    const points = signals
      .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map(s => [s.lat, s.lng, Number(s.weight) || 1] as [number, number, number]);

    if (points.length === 0) return;

    const heat = L.heatLayer(points, {
      pane: HEAT_PANE,
      radius,
      blur: Math.round(radius * 0.75),
      max: 3,
      maxZoom: 14,
      minOpacity: 0.2,
      gradient: HEAT_GRADIENT,
    });

    heat.addTo(map);

    // leaflet.heat 0.2.0 ignores the `pane` option -- its onAdd hardcodes
    // overlayPane.appendChild(canvas). That drops a full-viewport canvas on
    // top of the marker canvas with pointer events enabled, which swallows
    // every click on a lead and paints the heat OVER the band pins instead
    // of under them. Fix both by hand once the layer is attached.
    const canvas = (heat as unknown as { _canvas?: HTMLCanvasElement })._canvas;
    if (canvas) {
      canvas.style.pointerEvents = 'none';
      const pane = map.getPane(HEAT_PANE);
      if (pane && canvas.parentNode !== pane) pane.appendChild(canvas);
    }

    layerRef.current = heat;

    return () => {
      // onRemove calls overlayPane.removeChild(canvas), so the canvas has to
      // be back in overlayPane or removal throws NotFoundError.
      if (canvas) {
        const overlay = map.getPanes().overlayPane;
        if (canvas.parentNode !== overlay) overlay.appendChild(canvas);
      }
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, signals, visible, radius, pluginReady]);

  return null;
}
