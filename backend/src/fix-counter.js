/**
 * fix-counter.js  —  Run ONCE to fix your existing database
 * 
 * Run with: node fix-counter.js
 * 
 * What it does:
 * 1. Finds the highest existing complaintId sequence number
 * 2. Sets the Counter to that number
 * 3. From now on, every new complaint gets a guaranteed-unique ID
 */

import { connectDB } from './db.js';
import { Complaint, Counter } from './models/Complaint.js';

await connectDB();

console.log('🔧 Fixing complaint ID counter...');

// Find all existing complaintIds that match JV-YYYY-NNNNN pattern
const complaints = await Complaint.find(
  { complaintId: { $regex: /^JV-\d{4}-\d+$/ } },
  { complaintId: 1 }
).lean();

let maxSeq = 0;
for (const c of complaints) {
  // Extract the number part: "JV-2026-00004" → 4
  const parts = c.complaintId.split('-');
  const seq = parseInt(parts[2], 10);
  if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
}

console.log(`📊 Highest existing complaintId sequence: ${maxSeq}`);

// Upsert the counter to the highest found value
await Counter.findByIdAndUpdate(
  'complaintId',
  { $set: { seq: maxSeq } },
  { upsert: true }
);

console.log(`✅ Counter set to ${maxSeq}`);
console.log(`   Next new complaint will be: JV-${new Date().getFullYear()}-${String(maxSeq + 1).padStart(5, '0')}`);
console.log('\n🎉 Done! Your backend will now generate unique complaint IDs.');
process.exit(0);