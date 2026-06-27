import { Router } from 'express';
import Payout from '../models/Payout';
import { protect } from '../middleware/auth';
import { checkRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect, checkRole('superadmin'));

router.patch('/:id/mark-paid', asyncHandler(async (req, res) => {
  const payout = await Payout.findById(req.params.id);
  if (!payout) return sendError(res, 'Payout not found', 404);
  payout.status = 'paid';
  payout.paidAt = new Date();
  payout.paidBy = req.user!.id as unknown as typeof payout.paidBy;
  if (req.body.note) payout.note = req.body.note;
  await payout.save();
  return sendSuccess(res, payout, 'Payout marked as paid');
}));

export default router;
