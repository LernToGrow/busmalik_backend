import { Router } from 'express';
import { body } from 'express-validator';
import CityStop from '../models/CityStop';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.city) filter.city = { $regex: new RegExp(`^${req.query.city}$`, 'i') };
  const cityStops = await CityStop.find(filter).sort({ city: 1 });
  return sendSuccess(res, cityStops);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const cs = await CityStop.findById(req.params.id);
  if (!cs) return sendError(res, 'Not found', 404);
  return sendSuccess(res, cs);
}));

router.post(
  '/',
  [body('city').notEmpty().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const existing = await CityStop.findOne({ city: { $regex: new RegExp(`^${req.body.city}$`, 'i') } });
    if (existing) return sendError(res, 'City already exists', 400);
    const cs = await CityStop.create({ city: req.body.city, stops: req.body.stops ?? [] });
    return sendSuccess(res, cs, 'City stops created', 201);
  })
);

router.put(
  '/:id',
  [body('city').optional().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const cs = await CityStop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cs) return sendError(res, 'Not found', 404);
    return sendSuccess(res, cs, 'City stops updated');
  })
);

router.delete('/:id', asyncHandler(async (req, res) => {
  const cs = await CityStop.findByIdAndDelete(req.params.id);
  if (!cs) return sendError(res, 'Not found', 404);
  return sendSuccess(res, null, 'City stops deleted');
}));

export default router;
