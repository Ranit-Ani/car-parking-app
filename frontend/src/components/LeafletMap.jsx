import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom lightweight pin icons built from inline HTML/CSS instead of
// Leaflet's default marker images — those reference relative image paths
// that don't reliably resolve once bundled, and this way each marker kind
// (you / parking / destination) gets its own color at no extra asset cost.
function makeIcon(color, glyph) {
  return L.divIcon({
    className: 'ag-leaflet-pin',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.9)"><span style="transform:rotate(45deg);font-size:14px;line-height:1">${glyph}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

export const ICONS = {
  user: makeIcon('#0075ff', '📍'),
  parking: makeIcon('#00ffb3', '🅿️'),
  parkingSelected: makeIcon('#ff3c78', '🅿️'),
  destination: makeIcon('#ff3c78', '🏁'),
};

// Minimal HTML-escaping for text we drop into a divIcon/tooltip via innerHTML.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reusable in-app map for Nearby Parking + Navigate to Parking. Uses plain
 * Leaflet (not react-leaflet) for full imperative control over live
 * position updates and route redraws without extra dependency friction.
 *
 * @param {Array<{id, lat, lng, icon?, label?, tag?, onClick?}>} markers
 *   `tag: { title, subtitle? }` renders a small always-visible caption above the
 *   pin (e.g. title="Parking 01", subtitle="20/30") — separate from `label`,
 *   which is the click/tap popup.
 * @param {Array<[number, number]>} [route] - polyline coordinates, [lat,lng] pairs
 * @param {{lat, lng}} [center] - used before any markers/route exist
 * @param {boolean} [fitToData=true] - auto-fit bounds to markers/route when they change
 * @param {function({lat, lng})} [onPick] - if provided, the map becomes a picker:
 *   clicking anywhere calls onPick(latLng). Pair with a marker whose `draggable: true`
 *   flag is set (and give it an `onDrag` handler) to let the same point be fine-tuned
 *   by dragging instead of only clicking.
 */
export default function LeafletMap({ markers = [], route = null, center, zoom = 14, height = 320, fitToData = true, onPick = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    map.setView(center ? [center.lat, center.lng] : [20.5937, 78.9629], center ? zoom : 5);
    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('click', (e) => {
      if (onPickRef.current) onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fix sizing if the map first rendered while hidden (e.g. inside a modal
  // that was mid-transition), which otherwise leaves Leaflet with a
  // 0-height canvas. Guarded on offsetParent: while the container is
  // display:none (see body.ag-modal-open in styles/extra.css — the map is
  // hidden that way whenever any modal is open, to avoid a mobile
  // rendering bug), offsetParent is null and its measured size would be
  // 0x0, so calling invalidateSize() here would wrongly reset Leaflet's
  // internal size and leave it blank/broken once it's shown again.
  useEffect(() => {
    const t = setTimeout(() => {
      if (mapRef.current && containerRef.current && containerRef.current.offsetParent !== null) {
        mapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(t);
  });

  // Redraw markers + route whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerLayerRef.current.clearLayers();
    const bounds = [];
    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const marker = L.marker([m.lat, m.lng], { icon: m.icon || ICONS.parking, draggable: !!m.draggable });
      if (m.label) marker.bindPopup(m.label);
      if (m.tag && m.tag.title) {
        const html = `<div class="ag-marker-tag-title">${escapeHtml(m.tag.title)}</div>${
          m.tag.subtitle != null ? `<div class="ag-marker-tag-sub">${escapeHtml(m.tag.subtitle)}</div>` : ''
        }`;
        marker.bindTooltip(html, {
          permanent: true,
          direction: 'top',
          offset: [0, -28],
          className: 'ag-marker-tag',
          interactive: false,
        });
      }
      if (m.onClick) marker.on('click', m.onClick);
      if (m.draggable && m.onDrag) {
        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          m.onDrag({ lat: pos.lat, lng: pos.lng });
        });
      }
      marker.addTo(markerLayerRef.current);
      bounds.push([m.lat, m.lng]);
    });

    routeLayerRef.current.clearLayers();
    if (route && route.length > 1) {
      L.polyline(route, { color: '#00f0ff', weight: 5, opacity: 0.85 }).addTo(routeLayerRef.current);
      bounds.push(...route);
    }

    if (fitToData && bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], Math.max(map.getZoom(), zoom));
      } else {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
    } else if (!fitToData && center) {
      map.setView([center.lat, center.lng], zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, route, fitToData]);

  // When there's nothing to fit to yet, still recenter on `center` as it
  // arrives (e.g. the very first GPS fix).
  useEffect(() => {
    if (center && mapRef.current && markers.length === 0 && (!route || route.length < 2)) {
      mapRef.current.setView([center.lat, center.lng], zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center && center.lat, center && center.lng]);

  return <div ref={containerRef} style={{ height, borderRadius: 12, overflow: 'hidden' }} />;
}