/**
 * backend/src/routes/Auth.js
 * No changes needed — routes are the same; controller handles the new roles.
 */

import express from 'express';
import {
  registerCitizen, loginCitizen,
  registerAdmin,   loginAdmin,
  getMe, forgotPassword, resetPassword,
} from '../controllers/AuthController.js';
import { protect } from '../middleware/Auth.js';

const router = express.Router();

// ── Citizen ───────────────────────────────────────────────────
router.post('/citizen/register', registerCitizen);
router.post('/citizen/login',    loginCitizen);

// ── Admin (handles superAdmin, dept_officer, legacy admin) ────
router.post('/admin/register', registerAdmin);
router.post('/admin/login',    loginAdmin);

// ── Shared ────────────────────────────────────────────────────
router.get('/me',               protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;