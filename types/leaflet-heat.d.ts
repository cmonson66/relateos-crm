// Module augmentation rather than a global `namespace L` block — the repo
// already has @types/leaflet installed and a global declaration would
// collide with it.
import 'leaflet';

declare module 'leaflet' {
  interface HeatLayerOptions {
    pane?: string;
    radius?: number;
    blur?: number;
    max?: number;
    maxZoom?: number;
    minOpacity?: number;
    gradient?: Record<number, string>;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: Array<[number, number, number?]>): this;
    addLatLng(latlng: [number, number, number?]): this;
    setOptions(options: HeatLayerOptions): this;
    redraw(): this;
  }

  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: HeatLayerOptions
  ): HeatLayer;
}
