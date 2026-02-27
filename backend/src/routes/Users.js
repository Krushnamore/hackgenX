import express from 'express';
import { getLeaderboard, getProfile, updateProfile, changePassword, getAllCitizens } from '../controllers/UserController.js';
import { protect, requireRole } from '../middleware/Auth.js';

const router = express.Router();

router.use(protect);

router.get('/leaderboard', getLeaderboard);               // public (but needs auth)
router.get('/me',          getProfile);
router.patch('/me',        updateProfile);
router.patch('/me/password', changePassword);
router.get('/',            requireRole('admin'), getAllCitizens);

export default router;