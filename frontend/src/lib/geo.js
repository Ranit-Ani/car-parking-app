// ─── Geo utilities for Nearby Parking & In-App Navigation ──────────────────
// Everything here uses free, keyless services (OpenStreetMap Nominatim for
// geocoding a searched place, OSRM's public demo router for turn-by-turn
// distance/ETA) so the feature needs no API key, and every result is drawn
// on our own in-app Leaflet map — nothing ever redirects out to Google Maps
// or another navigation app.

export const MAX_RADIUS_KM = 5;

/** Wrap navigator.geolocation.getCurrentPosition in a promise. */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000, ...options }
    );
  });
}

/**
 * Subscribe to live position updates.
 * @returns {() => void} unsubscribe function
 */
export function watchPosition(onUpdate, onError, options = {}) {
  if (!navigator.geolocation) {
    onError && onError(new Error('Geolocation is not supported on this device.'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
      }),
    (err) => onError && onError(err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000, ...options }
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Haversine straight-line distance in km between two {lat,lng} points. */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return '—';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

/**
 * Geocode a free-text place/address/landmark via OpenStreetMap's Nominatim
 * search API (no API key needed). Returns an array of
 * {label, lat, lng} candidates, nearest-match first.
 */
export async function geocodeSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Location search failed. Please try again.');
  const results = await res.json();
  return results.map((r) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

/**
 * Fetch a driving route between two {lat,lng} points from OSRM's public
 * demo server (free, keyless). Returns
 * { coordinates: [[lat,lng], ...], distanceKm, durationMin } or null.
 */
export async function fetchRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data && data.routes && data.routes[0];
  if (!route) return null;
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}
