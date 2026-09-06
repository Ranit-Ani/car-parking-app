import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Chart from 'chart.js/auto';
import Layout from '../../components/Layout';
import { EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';

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

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationId, setLocationId] = useState(searchParams.get('locationId') || '');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load the location list, and default to whichever location was passed
  // in via ?locationId= (e.g. the "Revenue" link from Parking Locations),
  // falling back to the first location.
  useEffect(() => {
    (async () => {
      setLocationsLoading(true);
      const d = await apiRequest('/admin/locations');
      setLocationsLoading(false);
      if (d && d.success) {
        setLocations(d.data);
        setLocationId((cur) => cur || (d.data[0] && d.data[0]._id) || '');
      }
    })();
  }, []);

  // Keep the URL in sync so the selected location survives a refresh/share.
  useEffect(() => {
    if (locationId) setSearchParams({ locationId }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    const d = await apiRequest(`/admin/locations/${locationId}/detail`);
    setLoading(false);
    if (d && d.success) {
      setDetail(d.data);
      drawChart(canvasRef.current, chartRef, d.data.daily);
    }
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

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

  useEffect(() => () => { if (chartRef.current) chartRef.current.destroy(); }, []);

  return (
    <Layout title="Location Wise Revenue" badge={false}>
      <div className="ag-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="ag-input-group" style={{ margin: 0, maxWidth: 360 }}>
          <label className="ag-label">Parking Location</label>
          {locationsLoading ? (
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
