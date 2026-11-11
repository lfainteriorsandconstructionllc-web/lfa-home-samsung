/* Copia a config.js. La configuración instalada es legible dentro del .wgt. */
window.CONFIG = {
  appName: "LFA Home",
  compactHomeControls: true,
  pagedHome: true,
  initialOptions: { tileArt: "full", samsungHomeButton: "disney" },
  hasTuner: null, // false en proyectores sin sintonizador; null conserva lo informado por la TV.
  city: null, // Opcional: { name: "TU CIUDAD", lat: 0, lon: 0 }, usa tus coordenadas.
  dock: ["Netflix", "YouTube", "Prime Video", "Disney+", "HBO Max"]
};
