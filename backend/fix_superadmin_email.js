/**
 * Run once to fix existing superAdmin emails in MongoDB
 * Usage: node fix_superadmin_email.js
 * Run from: backend/ folder
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.DB_URL;
if (!DB_URL) { console.error('DB_URL not found in .env'); process.exit(1); }

await mongoose.connect(DB_URL);
console.log('Connected to MongoDB');

const db = mongoose.connection.db;
const users = db.collection('users');

// Find all superAdmins without 'superadmin' in email
const badAdmins = await users.find({
  role : 'superAdmin',
  email: { $not: /superadmin/i }
}).toArray();

if (badAdmins.length === 0) {
  console.log('✅ All superAdmin emails already contain "superadmin". Nothing to fix.');
} else {
  console.log(`Found ${badAdmins.length} superAdmin(s) with non-compliant email:`);
  for (const admin of badAdmins) {
    const oldEmail = admin.email;
    // Convert: krishna@gmail.com → superadmin.krishna@gmail.com
    const parts    = oldEmail.split('@');
    const newEmail = `superadmin.${parts[0]}@${parts[1]}`;
    await users.updateOne({ _id: admin._id }, { $set: { email: newEmail } });
    console.log(`  ✅ ${oldEmail} → ${newEmail}`);
    console.log(`     Name: ${admin.name} | ID: ${admin._id}`);
  }
  console.log('\n⚠️  UPDATE YOUR LOGIN EMAIL to the new one shown above!');
}

await mongoose.disconnect();
console.log('Done.');