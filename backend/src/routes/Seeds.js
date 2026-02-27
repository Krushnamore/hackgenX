/**
 * Seeds.js
 * Run: node Seeds.js
 * Creates demo users + complaints in MongoDB Atlas
 */

import { connectDB } from './db.js';
import { User }      from './models/User.js';
import { Complaint, Counter } from './models/Complaint.js';  // import Counter too

await connectDB();

console.log('🌱 Seeding database...');

// Clear existing data + reset the counter
await User.deleteMany({});
await Complaint.deleteMany({});
await Counter.deleteMany({});  // ← CRITICAL: reset counter so IDs start from 1
console.log('🧹 Cleared existing data + reset ID counter');

// ── Create Citizens ───────────────────────────────────────────
const [c1, c2, c3] = await User.create([
  {
    role: 'citizen', name: 'Rahul Sharma', email: 'citizen1@janvani.in',
    password: 'pass123', phone: '9876543210', age: 28,
    address: '12A, Panchvati Colony, Nashik', ward: 7,
    pincode: '422003', aadharLast4: '4521', language: 'English',
    points: 850, badge: 'Silver', complaintsSubmitted: 12, complaintsResolved: 9,
  },
  {
    role: 'citizen', name: 'Priya Desai', email: 'citizen2@janvani.in',
    password: 'pass123', phone: '9765432109', age: 35,
    address: '7, Saraswati Nagar, Nashik', ward: 3,
    pincode: '422001', aadharLast4: '8832', language: 'Hindi',
    points: 1100, badge: 'Gold', complaintsSubmitted: 18, complaintsResolved: 15,
  },
  {
    role: 'citizen', name: 'Amit Kumar', email: 'citizen3@janvani.in',
    password: 'pass123', phone: '9654321098', age: 22,
    address: '45, Gandhi Chowk, Nashik', ward: 12,
    pincode: '422005', aadharLast4: '3309', language: 'Marathi',
    points: 320, badge: 'Bronze', complaintsSubmitted: 6, complaintsResolved: 4,
  },
]);

// ── Create Admin ──────────────────────────────────────────────
const admin = await User.create({
  role: 'admin', name: 'Officer Verma', email: 'admin@janvani.in',
  password: 'admin123', phone: '9500000001',
  employeeId: 'MUN-2026-0001', department: 'Roads & Infrastructure',
  post: 'Senior Officer', joinedDate: '2020-06-15',
});

console.log('✅ Users created:', [c1, c2, c3, admin].map(u => u.email).join(', '));

const today        = new Date().toISOString().split('T')[0];
const yesterday    = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

// ── Seed counter to 5 so next new complaint gets JV-2026-00006
// We insert seed complaints with explicit complaintIds (bypassing pre-save)
// and then set the counter to match.
await Counter.create({ _id: 'complaintId', seq: 5 });

// ── Create seed complaints with explicit IDs ──────────────────
// Use insertMany (bypasses pre-save hook) so we control the IDs exactly
await Complaint.insertMany([
  {
    complaintId: 'JV-2026-00001',
    citizenId: c3._id, citizenName: c3.name, citizenPhone: c3.phone,
    title: 'Street lights non-functional on Shivaji Road',
    description: '5 street lights on Shivaji Nagar road have been non-functional for 2 weeks causing safety hazards.',
    category: 'Electricity', priority: 'High', status: 'Resolved',
    ward: 12, location: 'Shivaji Nagar, Ward 12',
    gpsCoords: { lat: 20.0060, lng: 73.7900 },
    adminNote: 'Replaced faulty bulbs and repaired wiring. All 5 lights operational.',
    assignedOfficer: 'Officer Verma', department: 'Electricity',
    supportCount: 18, mergedCount: 5, resolvePhoto: '',
    timeline: [
      { label: 'Submitted',    done: true, date: threeDaysAgo },
      { label: 'Under Review', done: true, date: threeDaysAgo },
      { label: 'In Progress',  done: true, date: yesterday },
      { label: 'Resolved',     done: true, date: today },
    ],
    estimatedResolution: today,
    feedback: { rating: 4, comment: 'Fixed quickly. Thank you!', resolved: 'yes' },
  },
  {
    complaintId: 'JV-2026-00002',
    citizenId: c1._id, citizenName: c1.name, citizenPhone: c1.phone,
    title: 'Large pothole on MG Road near bus stop',
    description: 'A pothole approximately 4ft wide on MG Road near the main bus stop poses serious risk to commuters and vehicles.',
    category: 'Road', priority: 'Critical', status: 'In Progress',
    ward: 7, location: 'MG Road near Bus Stop, Ward 7',
    gpsCoords: { lat: 20.0059, lng: 73.7897 },
    adminNote: 'Road repair team dispatched.',
    assignedOfficer: 'Engineer Patil', department: 'Roads & Infrastructure',
    supportCount: 47, mergedCount: 23,
    timeline: [
      { label: 'Submitted',    done: true, date: threeDaysAgo },
      { label: 'Under Review', done: true, date: yesterday },
      { label: 'In Progress',  done: true, date: today },
      { label: 'Resolved',     done: false, date: null },
    ],
    estimatedResolution: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
  },
  {
    complaintId: 'JV-2026-00003',
    citizenId: c2._id, citizenName: c2.name, citizenPhone: c2.phone,
    title: 'Water pipe burst near Main Market',
    description: 'Water pipe has burst causing major waterlogging. Main market road is flooded. Multiple shops affected.',
    category: 'Water', priority: 'Critical', status: 'Submitted',
    ward: 3, location: 'Main Market Road, Ward 3',
    gpsCoords: { lat: 20.0055, lng: 73.7880 },
    supportCount: 31, mergedCount: 12,
    timeline: [
      { label: 'Submitted',    done: true,  date: today },
      { label: 'Under Review', done: false, date: null },
      { label: 'In Progress',  done: false, date: null },
      { label: 'Resolved',     done: false, date: null },
    ],
    estimatedResolution: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
  },
  {
    complaintId: 'JV-SOS-00001',
    citizenId: c1._id, citizenName: c1.name, citizenPhone: c1.phone,
    title: '🚨 SOS: Electric Hazard — Broken live wire',
    description: 'A high tension wire has snapped and is hanging dangerously low near the school gate on Nehru Road. Children at risk.',
    category: 'Electricity', priority: 'Critical', status: 'Under Review',
    ward: 7, location: 'Nehru Road near St. Xavier School, Ward 7',
    gpsCoords: { lat: 20.0062, lng: 73.7905 },
    isSOS: true, sosType: 'Electric',
    supportCount: 89, mergedCount: 0,
    adminNote: 'MSEDCL team alerted.',
    assignedOfficer: 'Officer Verma',
    timeline: [
      { label: 'Submitted',    done: true,  date: today },
      { label: 'Under Review', done: true,  date: today },
      { label: 'In Progress',  done: false, date: null },
      { label: 'Resolved',     done: false, date: null },
    ],
    estimatedResolution: today,
  },
  {
    complaintId: 'JV-2026-00005',
    citizenId: c3._id, citizenName: c3.name, citizenPhone: c3.phone,
    title: 'Garbage not collected for 3 days in Sector 5-B',
    description: 'Garbage collection van has not visited Sector 5-B for 3 consecutive days. Waste is overflowing from bins.',
    category: 'Sanitation', priority: 'High', status: 'Submitted',
    ward: 12, location: 'Sector 5-B, Ward 12',
    gpsCoords: { lat: 20.0058, lng: 73.7895 },
    supportCount: 25, mergedCount: 8,
    timeline: [
      { label: 'Submitted',    done: true,  date: today },
      { label: 'Under Review', done: false, date: null },
      { label: 'In Progress',  done: false, date: null },
      { label: 'Resolved',     done: false, date: null },
    ],
    estimatedResolution: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  },
]);

console.log('✅ 5 demo complaints created (counter set to 5)');
console.log('   Next new complaint will be: JV-' + new Date().getFullYear() + '-00006');
console.log('\n📋 Demo Login Credentials:');
console.log('  Citizen: citizen1@janvani.in / pass123');
console.log('  Citizen: citizen2@janvani.in / pass123');
console.log('  Citizen: citizen3@janvani.in / pass123');
console.log('  Admin:   admin@janvani.in    / admin123');
console.log('\n🎉 Seeding complete!');
process.exit(0);