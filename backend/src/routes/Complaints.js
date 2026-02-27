import express from 'express';
import {
  createComplaint, getComplaints, getComplaintById,
  updateStatus, resolveComplaint, supportComplaint,
  submitFeedback, deleteComplaint, getStats,
} from '../controllers/ComplaintController.js';
import { protect, requireRole } from '../middleware/Auth.js';

const router = express.Router();

// All routes need authentication
router.use(protect);

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', requireRole('admin'), getStats);

// ── CRUD ───────────────────────────────────────────────────────
router.get('/',   getComplaints);                             // admin=all, citizen=own
router.post('/',  requireRole('citizen'), createComplaint);  // citizen submits

router.get('/:id',    getComplaintById);

// ── Admin actions ──────────────────────────────────────────────
router.patch('/:id/status',  requireRole('admin'), updateStatus);
router.patch('/:id/resolve', requireRole('admin'), resolveComplaint);
router.delete('/:id',        requireRole('admin'), deleteComplaint);

// ── Citizen actions ────────────────────────────────────────────
router.post('/:id/support',  requireRole('citizen'), supportComplaint);
router.post('/:id/feedback', requireRole('citizen'), submitFeedback);

export default router;