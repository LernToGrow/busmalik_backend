import { Router } from 'express';
import City from '../models/City';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

const router = Router();

// Public — no auth needed for read-only reference data
router.get('/', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    filter.name = { $regex: new RegExp(String(req.query.search), 'i') };
  }
  if (req.query.state) {
    filter.state = { $regex: new RegExp(`^${String(req.query.state)}$`, 'i') };
  }
  const limit = req.query.search ? 10 : 50;
  const cities = await City.find(filter).sort({ name: 1 }).limit(limit).select('cityId name state -_id');
  return sendSuccess(res, cities);
}));

export default router;
