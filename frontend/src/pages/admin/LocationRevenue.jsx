import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Chart from 'chart.js/auto';
import Layout from '../../components/Layout';
import { EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { getCached, setCached } from '../../lib/pageCache';
import { getSocket } from '../../lib/socket';
import { useAdminLocations } from '../../lib/useAdminLocations';
import { useRevalidate } from '../../lib/useRevalidate';

function drawChart(canvas, chartRef, daily) {
  if (!canvas) return;
  if (chartRef.current) chartRef.current.destroy();
  chartRef.current = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: daily.map((x) => x._id),
      datasets: [{
        label: 'Revenue (₹)',
        data: daily.map((x) => x.revenue),
        backgroundColor: 'rgba(0,136,255,0.5)',
        borderColor: '#0088ff',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(0,245,255,0.6)',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(6,13,26,0.95)',
          titleColor: '#00f5ff',
          bodyColor: '#e8f4ff',
          borderColor: 'rgba(0,245,255,0.2)',
          borderWidth: 1,
        },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,136,255,0.08)' }, ticks: { color: '#5a7a9a' } },
        x: { grid: { display: false }, ticks: { color: '#5a7a9a' } },
      },
    },
  });
}

const detailCacheKey = (id) => `admin:location-revenue:${id}`;

// ─── Location Wise Revenue ────────────────────────────────────────────────
// Same revenue calculation logic as the overall Revenue page and the old
// per-location "Revenue" button on Parking Locations (both are powered by
// AdminService/Booking's location-scoped revenue aggregations) — just
// presented as its own page with a location picker, instead of living
// inside Location management.
export default function LocationRevenue() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Cached + live (socket) synced, shared with the other admin pages that
  // use this same list — shows instantly on revisit and stays current if
  // a location is added/renamed/removed elsewhere.
  const { locations, loading: locationsLoading } = useAdminLocations();
  const [locationId, setLocationId] = useState(searchParams.get('locationId') || '');

  // Seeded per-location from the shared page cache so switching back to a
  // location you already viewed (or navigating away to another page and
  // back) shows its figures and chart immediately instead of a loading
  // state, while a fresh copy is always fetched quietly in the background.
  const [detail, setDetail] = useState(() => (locationId ? getCached(detailCacheKey(locationId)) : null) || null);
  const [loading, setLoading] = useState(() => !!locationId && !getCached(detailCacheKey(locationId)));
  const locationIdRef = useRef(locationId);
  useEffect(() => { locationIdRef.current = locationId; }, [locationId]);

  // Default to whichever location was passed in via ?locationId= (e.g. the
  // "Revenue" link from Parking Locations), falling back to the first
  // location, once the (possibly cached, possibly freshly-fetched) list
  // is available.
  useEffect(() => {
    if (!locationId && locations.length > 0) setLocationId(locations[0]._id);
  }, [locations, locationId]);

  // Without a ?locationId= in the URL, picking a default location used to
  // require waiting for the full locations list to arrive, THEN firing a
  // second request for that location's detail — two sequential round
  // trips, which is what made this page visibly slower to first paint
  // than the single-request Overall Revenue page. This fetches the
  // default location's full detail (plus the list, for the picker) in one
  // combined request instead, so the page can paint after one round trip
  // just like Overall Revenue does.
  useEffect(() => {
    if (searchParams.get('locationId')) return undefined; // already know which one to show
    let cancelled = false;
    (async () => {
      const d = await apiRequest('/admin/locations/overview');
      if (cancelled || !d || !d.success || !d.data.detail) return;
      if (locationIdRef.current) return; // a selection already landed (dropdown / cache) — don't clobber it
      const det = d.data.detail;
      const id = det.location._id;
      setCached(detailCacheKey(id), det);
      setDetail(det);
      setLoading(false);
      setLocationId(id);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync so the selected location survives a refresh/share.
  useEffect(() => {
    if (locationId) setSearchParams({ locationId }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const load = useCallback(async () => {
    if (!locationId) return;
    const key = detailCacheKey(locationId);
    const cached = getCached(key);
    // Only show the full loading state when this exact location has never
    // been loaded before in this tab — otherwise this is just a silent
    // background revalidation of data already on screen.
    if (!cached) setLoading(true);
    const d = await apiRequest(`/admin/locations/${locationId}/detail`);
    setLoading(false);
    if (d && d.success) {
      setDetail(d.data);
      setCached(key, d.data);
    }
  }, [locationId]);

  // Whenever the selected location changes, immediately show whatever is
  // cached for it (instant repaint, no blank canvas) and then revalidate
  // against the server.
  useEffect(() => {
    if (!locationId) { setDetail(null); return; }
    const cached = getCached(detailCacheKey(locationId));
    if (cached) {
      setDetail(cached);
      setLoading(false);
    } else {
      setDetail(null);
      setLoading(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // Draw/redraw the chart only once React has actually committed the
  // <canvas> for the current `detail` — NOT immediately after setDetail()
  // is called. The <canvas> here is conditionally rendered (it only
  // exists once `detail.daily.length > 0`), so calling drawChart() right
  // after setDetail() (as this used to do, inside load() / the effects
  // above) ran against the *previous* render's canvasRef — still null the
  // very first time a location's data arrives, since the canvas hadn't
  // mounted yet. That silently dropped the first draw, and the chart only
  // appeared once something else called load() again — in practice the
  // 60s safety-net poll below, which is exactly the "~1 minute" delay.
  // Keying a useEffect on `detail` instead guarantees this runs after the
  // canvas (if any) is actually in the DOM.
  useEffect(() => {
    if (detail && detail.daily.length > 0) {
      drawChart(canvasRef.current, chartRef, detail.daily);
    }
  }, [detail]);

  useEffect(() => {
    // Live sync: a completed check-out (or any booking update) at this
    // location should refresh the figures immediately.
    const socket = getSocket();
    socket.on('revenueUpdated', load);
    socket.on('bookingUpdated', load);

    const t = setInterval(load, 60000);

    return () => {
      clearInterval(t);
      socket.off('revenueUpdated', load);
      socket.off('bookingUpdated', load);
    };
  }, [load]);

  // Reconnect/resume safety net for this location's own detail/chart data
  // (the shared locations list used for the picker already revalidates
  // itself inside useAdminLocations).
  useRevalidate(load);

  useEffect(() => () => { if (chartRef.current) chartRef.current.destroy(); }, []);

  return (
    <Layout title="Location Wise Revenue" badge={false}>
      <div className="ag-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="ag-input-group" style={{ margin: 0, maxWidth: 360 }}>
          <label className="ag-label">Parking Location</label>
          {locationsLoading && locations.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading locations...</div>
          ) : locations.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No parking locations yet. Add one from the Parking Locations page.</div>
          ) : (
            <select className="ag-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {!locationId ? null : loading && !detail ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading revenue...</div>
      ) : detail ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card green"><div className="stat-label">Total Revenue</div><div className="stat-value text-green">₹{(detail.revenue.totalRevenue || 0).toFixed(2)}</div></div>
            <div className="stat-card cyan"><div className="stat-label">Completed Bookings</div><div className="stat-value text-cyan">{detail.revenue.totalBookings}</div></div>
            <div className="stat-card orange"><div className="stat-label">Avg Booking Value</div><div className="stat-value text-orange">₹{(detail.revenue.avgAmount || 0).toFixed(2)}</div></div>
            <div className="stat-card purple"><div className="stat-label">Occupancy Rate</div><div className="stat-value">{detail.occupancyRate}%</div></div>
          </div>

          <div className="ag-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              DAILY REVENUE — {detail.location?.name?.toUpperCase()} — LAST 30 DAYS
            </div>
            {detail.daily.length === 0 ? (
              <EmptyState icon="bi-graph-up">No completed bookings at this location in the last 30 days.</EmptyState>
            ) : (
              <canvas ref={canvasRef} height={80} />
            )}
          </div>

          <div className="table-card" style={{ marginTop: '1.5rem' }}>
            <div className="tc-header"><h6><i className="bi bi-calendar3" style={{ marginRight: '0.4rem' }} />Daily Breakdown</h6></div>
            <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="ag-table">
                <thead><tr><th>Date</th><th>Revenue</th><th>Bookings</th></tr></thead>
                <tbody>
                  {detail.daily.length === 0 ? (
                    <tr><td colSpan={3}><EmptyState icon="bi-calendar3">No daily revenue yet.</EmptyState></td></tr>
                  ) : detail.daily.slice().reverse().map((row) => (
                    <tr key={row._id}>
                      <td>{row._id}</td>
                      <td className="text-green">₹{row.revenue.toFixed(2)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </Layout>
  );
}
//done