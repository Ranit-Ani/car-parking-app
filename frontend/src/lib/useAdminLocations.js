import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';
import { getSocket } from './socket';
import { useCachedState, wasCached } from './useCachedState';
import { useRevalidate } from './useRevalidate';

const CACHE_KEY = 'admin:locations';

/**
 * useAdminLocations
 *
 * Every admin page that needs the parking-locations list (Parking
 * Locations, Slot Management's location picker, User Management's
 * staff-location picker/filter, Location Wise Revenue's picker) used to
 * fetch `/admin/locations` independently with a plain useState — meaning
 * the list reset to empty and re-fetched from scratch on every single
 * page visit, and never picked up a location being renamed/added/removed
 * (or a staff count changing) from elsewhere while the page was open.
 *
 * This hook centralizes that: the list is seeded from the shared page
 * cache so it appears instantly on revisit (same pattern as
 * useCachedState/useInfiniteList elsewhere in the app), and it stays live
 * via socket events instead of only ever reflecting whatever was true the
 * moment the page first mounted.
 */
export function useAdminLocations() {
  const [locations, setLocations] = useCachedState(CACHE_KEY, []);
  const [loading, setLoading] = useState(!wasCached(CACHE_KEY));

  const load = useCallback(async () => {
    const d = await apiRequest('/admin/locations');
    if (d && d.success) setLocations(d.data);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLocations]);

  useEffect(() => {
    load();

    // Live sync: a location being added/renamed/deleted, or a staff
    // member being (re)assigned to one (which changes its staff count),
    // should reflect everywhere this list is used — instantly, not just
    // on the next full page reload.
    const socket = getSocket();
    socket.on('locationUpdated', load);
    socket.on('locationDeleted', load);
    socket.on('staffUpdated', load);
    return () => {
      socket.off('locationUpdated', load);
      socket.off('locationDeleted', load);
      socket.off('staffUpdated', load);
    };
  }, [load]);

  // Reconnect/resume safety net — shared by every page that uses this
  // hook (Locations, Slots' location picker, Users' staff-location
  // picker, Location Wise Revenue's picker).
  useRevalidate(load);

  return { locations, loading, refresh: load };
}
