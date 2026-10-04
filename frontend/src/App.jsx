import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NavProvider } from './context/NavContext';
import RequireAuth from './components/RequireAuth';
import AppShell from './components/AppShell';
import ToastHost from './components/ToastHost';
import SessionExpiredOverlay from './components/SessionExpiredOverlay';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

import UserDashboard from './pages/user/Dashboard';
import UserBookings from './pages/user/Bookings';
import UserNearbyParking from './pages/user/NearbyParking';

import StaffDashboard from './pages/staff/Dashboard';
import StaffCheckIn from './pages/staff/CheckIn';
import StaffCheckOut from './pages/staff/CheckOut';
import StaffBookings from './pages/staff/Bookings';
import StaffQRCheckIn from './pages/staff/QRCheckIn';

import AdminDashboard from './pages/admin/Dashboard';
import AdminSlots from './pages/admin/Slots';
import AdminLocations from './pages/admin/Locations';
import AdminUsers from './pages/admin/Users';
import AdminRevenue from './pages/admin/Revenue';
import AdminLocationRevenue from './pages/admin/LocationRevenue';
import AdminBookings from './pages/admin/Bookings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavProvider>
        <ToastHost />
        <SessionExpiredOverlay />
        <AppShell>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/profile" element={<RequireAuth roles={['user', 'staff', 'admin']}><Profile /></RequireAuth>} />

          <Route path="/user/dashboard" element={<RequireAuth roles={['user']}><UserDashboard /></RequireAuth>} />
          <Route path="/user/nearby" element={<RequireAuth roles={['user']}><UserNearbyParking /></RequireAuth>} />
          {/* The old Slots & Booking page showed slots from every parking
              location at once. Users now book exclusively through Nearby
              Parking (pick a location → see only that location's slots),
              so these legacy links redirect there instead of 404ing. */}
          <Route path="/user/slots" element={<Navigate to="/user/nearby" replace />} />
          <Route path="/user/book" element={<Navigate to="/user/nearby" replace />} />
          <Route path="/user/bookings" element={<RequireAuth roles={['user']}><UserBookings /></RequireAuth>} />

          <Route path="/staff/dashboard" element={<RequireAuth roles={['staff', 'admin']}><StaffDashboard /></RequireAuth>} />
          <Route path="/staff/checkin" element={<RequireAuth roles={['staff', 'admin']}><StaffCheckIn /></RequireAuth>} />
          <Route path="/staff/qr-checkin" element={<RequireAuth roles={['staff', 'admin']}><StaffQRCheckIn /></RequireAuth>} />
          <Route path="/staff/checkout" element={<RequireAuth roles={['staff', 'admin']}><StaffCheckOut /></RequireAuth>} />
          <Route path="/staff/bookings" element={<RequireAuth roles={['staff', 'admin']}><StaffBookings /></RequireAuth>} />

          <Route path="/admin/dashboard" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/slots" element={<RequireAuth roles={['admin']}><AdminSlots /></RequireAuth>} />
          <Route path="/admin/locations" element={<RequireAuth roles={['admin']}><AdminLocations /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
          <Route path="/admin/revenue" element={<RequireAuth roles={['admin']}><AdminRevenue /></RequireAuth>} />
          <Route path="/admin/location-revenue" element={<RequireAuth roles={['admin']}><AdminLocationRevenue /></RequireAuth>} />
          <Route path="/admin/bookings" element={<RequireAuth roles={['admin']}><AdminBookings /></RequireAuth>} />

          <Route path="*" element={<Landing />} />
        </Routes>
        </AppShell>
        </NavProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}