// Untyped plugin. This file must stay free of top-level imports: with an
// import it becomes a module, and `declare module 'leaflet.heat'` would be
// read as an augmentation of an already-typed module instead of a
// declaration for an untyped one — which is exactly the TS7016 this fixes.
declare module 'leaflet.heat';
