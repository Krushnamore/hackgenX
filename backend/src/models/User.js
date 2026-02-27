import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    // ── Shared fields ──────────────────────────────────────────
    role     : { type: String, enum: ['citizen', 'admin'], required: true },
    name     : { type: String, required: true, trim: true },
    email    : { type: String, required: true, unique: true, lowercase: true, trim: true },
    password : { type: String, required: true, minlength: 4 },
    phone    : { type: String, required: true },

    // ── Citizen-only fields ────────────────────────────────────
    age         : { type: Number },
    address     : { type: String },
    ward        : { type: Number, min: 1, max: 20 },
    pincode     : { type: String },
    aadharLast4 : { type: String, maxlength: 4 },
    language    : { type: String, default: 'English' },
    points      : { type: Number, default: 0 },
    badge       : { type: String, enum: ['Bronze', 'Silver', 'Gold'], default: 'Bronze' },
    complaintsSubmitted : { type: Number, default: 0 },
    complaintsResolved  : { type: Number, default: 0 },

    // ── Admin-only fields ──────────────────────────────────────
    employeeId : { type: String },
    department : {
      type: String,
      enum: ['Roads & Infrastructure', 'Water Supply', 'Sanitation', 'Electricity', 'Planning', 'General Administration', ''],
      default: '',
    },
    post : {
      type: String,
      default: '',
    },
    joinedDate : { type: String },
  },
  { timestamps: true }
);

// ── Hash password before save ──────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// ── Compare password ───────────────────────────────────────────
userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

// ── Auto-update badge based on points ─────────────────────────
userSchema.methods.updateBadge = function () {
  if (this.points >= 1000) this.badge = 'Gold';
  else if (this.points >= 500) this.badge = 'Silver';
  else this.badge = 'Bronze';
};

// ── Remove password from JSON output ──────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model('User', userSchema);