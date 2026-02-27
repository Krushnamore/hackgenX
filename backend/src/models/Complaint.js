import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────
// Counter schema — atomic sequence generator
// Ensures complaintIds are ALWAYS unique, even under concurrent requests
// ─────────────────────────────────────────────────────────────
const counterSchema = new mongoose.Schema({
  _id : { type: String, required: true },   // e.g. "complaintId"
  seq : { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

// ─────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────
const timelineStepSchema = new mongoose.Schema({
  label : { type: String, required: true },
  done  : { type: Boolean, default: false },
  date  : { type: String, default: null },
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  rating   : { type: Number, min: 1, max: 5 },
  comment  : { type: String, default: '' },
  resolved : { type: String, enum: ['yes', 'no', 'partially'] },
}, { _id: false });

// ─────────────────────────────────────────────────────────────
// Complaint schema
// ─────────────────────────────────────────────────────────────
const complaintSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────
    complaintId  : { type: String, unique: true, sparse: true },  // JV-2026-XXXXX
    citizenId    : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    citizenName  : { type: String, required: true },
    citizenPhone : { type: String, required: true },

    // ── Issue details ─────────────────────────────────────────
    title       : { type: String, required: true },
    description : { type: String, required: true },
    category    : {
      type     : String,
      enum     : ['Road', 'Water', 'Sanitation', 'Electricity', 'Other'],
      required : true,
    },
    priority : {
      type    : String,
      enum    : ['Low', 'Medium', 'High', 'Critical'],
      default : 'Medium',
    },
    status : {
      type    : String,
      enum    : ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'],
      default : 'Submitted',
    },

    // ── Location ──────────────────────────────────────────────
    ward     : { type: Number, required: true },
    location : { type: String, default: '' },
    gpsCoords: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },

    // ── Media ─────────────────────────────────────────────────
    photo        : { type: String, default: '' },
    resolvePhoto : { type: String, default: '' },

    // ── Admin fields ──────────────────────────────────────────
    adminNote       : { type: String, default: '' },
    assignedOfficer : { type: String, default: '' },
    department      : { type: String, default: '' },

    // ── Stats ─────────────────────────────────────────────────
    mergedCount  : { type: Number, default: 0 },
    supportCount : { type: Number, default: 0 },
    supportedBy  : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ── Timeline ──────────────────────────────────────────────
    timeline : {
      type    : [timelineStepSchema],
      default : () => [
        { label: 'Submitted',    done: true,  date: new Date().toISOString().split('T')[0] },
        { label: 'Under Review', done: false, date: null },
        { label: 'In Progress',  done: false, date: null },
        { label: 'Resolved',     done: false, date: null },
      ],
    },

    estimatedResolution : { type: String, default: '' },
    feedback            : { type: feedbackSchema, default: null },

    // ── SOS flag ──────────────────────────────────────────────
    isSOS   : { type: Boolean, default: false },
    sosType : { type: String, default: '' },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────
// FIXED: Atomic complaintId generation using a Counter document
//
// $findOneAndUpdate with $inc is atomic in MongoDB — even if 100
// requests arrive at the same time, each gets a unique sequence number.
// This completely eliminates the E11000 duplicate key error.
// ─────────────────────────────────────────────────────────────
complaintSchema.pre('save', async function (next) {
  // Only generate if this is a new document without an ID yet
  if (this.isNew && !this.complaintId) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        'complaintId',               // the counter document id
        { $inc: { seq: 1 } },        // atomically increment
        { new: true, upsert: true }  // create if doesn't exist
      );
      const year = new Date().getFullYear();
      this.complaintId = `JV-${year}-${String(counter.seq).padStart(5, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  return next();
});

// ─────────────────────────────────────────────────────────────
// Index for fast lookups by citizenId and status
// ─────────────────────────────────────────────────────────────
complaintSchema.index({ citizenId: 1, createdAt: -1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ ward: 1 });

export { Counter };  // export so Seeds.js can reset it
export const Complaint = mongoose.model('Complaint', complaintSchema);