/**
 * backend/src/models/User.js
 *
 * Role enum supports two-tier admin hierarchy:
 *   'superAdmin'   → city-wide monitor, sees ALL complaints + dept filter bar
 *   'dept_officer' → sees ONLY complaints in their own department
 *   'admin'        → legacy role, behaves like dept_officer
 *   'citizen'      → public user who files complaints
 */

import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    // ── Role ────────────────────────────────────────────────────
    role: {
      type    : String,
      enum    : ['citizen', 'admin', 'superAdmin', 'dept_officer'],
      required: true,
    },

    // ── Common fields ────────────────────────────────────────────
    name     : { type: String, required: true, trim: true },
    email    : { type: String, required: true, unique: true, lowercase: true },
    password : { type: String, required: true },
    phone    : { type: String, required: true },

    // ── Citizen-only fields ──────────────────────────────────────
    age                 : Number,
    address             : String,
    ward                : Number,
    pincode             : String,
    aadharLast4         : String,
    language            : { type: String, default: 'English' },
    points              : { type: Number, default: 0 },
    badge               : { type: String, enum: ['Bronze', 'Silver', 'Gold'], default: 'Bronze' },
    complaintsSubmitted : { type: Number, default: 0 },
    complaintsResolved  : { type: Number, default: 0 },
    avatar              : { type: String, default: null },

    // ── Admin / Officer fields ────────────────────────────────────
    // department: the department this officer manages.
    // superAdmin gets 'All Departments' automatically.
    department : { type: String, default: '' },
    post       : { type: String, default: '' },
    employeeId : { type: String, default: '' },
    joinedDate : { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Hash password before save ─────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Password comparison ───────────────────────────────────────
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// ── Indexes ───────────────────────────────────────────────────
// NOTE: email index is created automatically by unique:true above — no need to repeat it here
userSchema.index({ role: 1 });
userSchema.index({ department: 1 }, { sparse: true });

export const User = mongoose.model('User', userSchema);