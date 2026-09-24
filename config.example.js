/**
 * Optional live-data config (do not commit real keys).
 * Copy to config.js and set values, or inject via Render as a generated file.
 *
 * Absolute best for contact accuracy: Google Places API (New)
 *   https://console.cloud.google.com/google/maps-apis
 *   Enable Places API (New). Restrict key by HTTP referrer to your domain.
 *   Prefer a Render proxy in production so the key is never public.
 *
 * Strong OSM commercial layer: Geoapify Places (free tier)
 *   https://www.geoapify.com/
 *
 * Free path (no keys): OpenStreetMap Overpass — always used as final fallback.
 */
window.ROLLPHASE_CONFIG = {
  // googlePlacesApiKey: "",
  // geoapifyApiKey: "",
  // defaultRadiusM: 10000,
};
