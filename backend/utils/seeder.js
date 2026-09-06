require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await ParkingSlot.deleteMany({});
    await ParkingLocation.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Admin
    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@campus.edu',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      isEmailVerified: true,
    });
    console.log(`👤 Admin created: ${admin.email}`);

    // Create Staff
    const staff = await User.create({
      name: 'Parking Staff',
      email: 'staff@campus.edu',
      password: 'Staff@123',
      role: 'staff',
      isEmailVerified: true,
    });
    console.log(`👤 Staff created: ${staff.email}`);

    // Create Test User
    const user = await User.create({
      name: 'Test Student',
      email: 'student@campus.edu',
      password: 'Student@123',
      role: 'user',
      isEmailVerified: true,
    });
    console.log(`👤 User created: ${user.email}`);

    // ─── Parking Locations (multi-location support) ───────────────────────────
    // A handful of real-ish, geo-located sites spread within ~5km of each
    // other so the "Nearby Parking" radius search (max 5km) and the
    // location-search flow both have something meaningful to find.
    // Coordinates are centered around a sample campus area in New Delhi.
    const locationDefs = [
      {
        name: 'Block A - Main Gate',
        address: 'Main Gate Road, Campus Sector 1',
        description: 'Primary entrance parking, closest to the admin building.',
        amenities: ['CCTV', 'Covered', 'Security Guard'],
        coordinates: [77.2090, 28.6139], // [lng, lat]
      },
      {
        name: 'Block B - Library Annex',
        address: 'Library Road, Campus Sector 2',
        description: 'Parking behind the central library, a short walk to lecture halls.',
        amenities: ['CCTV', 'EV Charging'],
        coordinates: [77.2125, 28.6180],
      },
      {
        name: 'Block C - Sports Complex',
        address: 'Stadium Avenue, Campus Sector 3',
        description: 'Open-air lot next to the sports complex and gymnasium.',
        amenities: ['Well Lit'],
        coordinates: [77.2050, 28.6250],
      },
      {
        name: 'North Campus Parking',
        address: 'North Wing Extension Road',
        description: 'Overflow parking for the north campus extension, a bit further out.',
        amenities: ['CCTV', 'Covered'],
        coordinates: [77.1950, 28.6400],
      },
      {
        name: 'City Center Mall Parking',
        address: 'City Center Mall, Sector 5',
        description: 'Off-campus public parking facility, handy when campus lots are full.',
        amenities: ['CCTV', 'Valet', 'EV Charging'],
        coordinates: [77.2200, 28.5900],
      },
    ];

    const parkingLocations = await ParkingLocation.insertMany(
      locationDefs.map((l) => ({
        name: l.name,
        address: l.address,
        description: l.description,
        amenities: l.amenities,
        geo: { type: 'Point', coordinates: l.coordinates },
      }))
    );
    console.log(`📍 Created ${parkingLocations.length} parking locations`);

    // Create Parking Slots
    const slots = [];
    const types = ['standard', 'faculty', 'disabled', 'ev'];

    // Generate 30 slots, cycled across the seeded parking locations so
    // each location has a realistic mix of slot types/availability.
    for (let i = 1; i <= 30; i++) {
      const typeIndex = i <= 20 ? 0 : i <= 25 ? 1 : i <= 28 ? 2 : 3;
      const loc = parkingLocations[i % parkingLocations.length];
      slots.push({
        slotNumber: `P${String(i).padStart(3, '0')}`,
        location: loc.name,
        locationId: loc._id,
        floor: i <= 10 ? 'Ground' : i <= 20 ? 'First' : 'Second',
        slotType: types[typeIndex],
        status: 'Available',
        hourlyRate: typeIndex === 0 ? 20 : typeIndex === 1 ? 30 : typeIndex === 2 ? 10 : 40,
      });
    }

    await ParkingSlot.insertMany(slots);
    console.log(`🅿️  Created ${slots.length} parking slots`);

    console.log('\n✅ Seeding complete!');
    console.log('─────────────────────────────────────');
    console.log('  Admin:   admin@campus.edu / Admin@123');
    console.log('  Staff:   staff@campus.edu / Staff@123');
    console.log('  Student: student@campus.edu / Student@123');
    console.log('─────────────────────────────────────');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seedData();
