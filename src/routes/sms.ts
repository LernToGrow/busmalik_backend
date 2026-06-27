import { Router } from 'express';
import SmsLog from '../models/SmsLog';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(protect);

router.get('/logs', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.bookingId) filter.bookingId = req.query.bookingId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from) filter.createdAt = { $gte: new Date(req.query.from as string) };
  const logs = await SmsLog.find(filter).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(res, logs);
}));

export default router;
