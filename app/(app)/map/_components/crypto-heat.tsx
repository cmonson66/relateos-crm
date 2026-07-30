'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { HEAT_GRADIENT, type CryptoSignal } from '@/lib/crypto/density';

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
  // than importing it. Under a bundler that global doesn't exist, so set it
  // first and load the plugin after. If it fails we never render heat and
  // the rest of the map is untouched.
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

  useEffect(() => {
    // Teardown is wrapped in try/catch on purpose. This component unmounts
    // during client-side navigation (clicking "Open account" in a popup), and
    // anything thrown here aborts the navigation and blanks the page.
    const detach = () => {
      const layer = layerRef.current;
      layerRef.current = null;
      if (!layer) return;
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      } catch (err) {
        console.warn('crypto heat teardown', err);
      }
    };

    detach();

    if (!pluginReady || !visible || signals.length === 0) return;

    const points = signals
      .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map(s => [s.lat, s.lng, Number(s.weight) || 1] as [number, number, number]);

    if (points.length === 0) return;

    const heat = L.heatLayer(points, {
      radius,
      blur: Math.round(radius * 0.75),
      max: 3,
      maxZoom: 14,
      minOpacity: 0.2,
      gradient: HEAT_GRADIENT,
    });

    heat.addTo(map);

    // leaflet.heat 0.2.0 hardcodes `overlayPane.appendChild(canvas)` and
    // ignores the `pane` option, so its canvas lands on top of the marker
    // canvas with pointer events on — swallowing every click on a lead.
    //
    // Rather than relocate it to another pane (which breaks its onRemove,
    // since that calls overlayPane.removeChild), leave it in overlayPane and
    // just move it to the front of the child list. Same pane, so removal
    // still works; earlier in DOM order, so it paints beneath the markers.
    try {
      const canvas = (heat as unknown as { _canvas?: HTMLCanvasElement })._canvas;
      const overlay = map.getPanes()?.overlayPane;
      if (canvas) {
        canvas.style.pointerEvents = 'none';
        if (overlay && canvas.parentNode === overlay && overlay.firstChild !== canvas) {
          overlay.insertBefore(canvas, overlay.firstChild);
        }
      }
    } catch (err) {
      console.warn('crypto heat canvas setup', err);
    }

    layerRef.current = heat;

    return detach;
  }, [map, signals, visible, radius, pluginReady]);

  return null;
}
