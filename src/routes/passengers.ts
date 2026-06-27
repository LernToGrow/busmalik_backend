import { Router } from 'express';
import { body } from 'express-validator';
import Passenger from '../models/Passenger';
import Booking from '../models/Booking';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect);

router.post(
  '/',
  [body('name').notEmpty(), body('phone').isLength({ min: 10, max: 10 })],
  validate,
  asyncHandler(async (req, res) => {
    const existing = await Passenger.findOne({ phone: req.body.phone });
    if (existing) return sendSuccess(res, existing, 'Passenger already exists');
    const p = await Passenger.create({ ...req.body, createdBy: req.user!.id });
    return sendSuccess(res, p, 'Passenger created', 201);
  })
);

router.get('/', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    const re = new RegExp(req.query.search as string, 'i');
    filter.$or = [{ name: re }, { phone: re }];
  }
  if (req.user!.role === 'superadmin' && req.query.operatorId) filter.createdBy = req.query.operatorId;
  const passengers = await Passenger.find(filter).limit(50);
  return sendSuccess(res, passengers);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const p = await Passenger.findById(req.params.id);
  if (!p) return sendError(res, 'Passenger not found', 404);
  return sendSuccess(res, p);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const p = await Passenger.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!p) return sendError(res, 'Passenger not found', 404);
  return sendSuccess(res, p, 'Passenger updated');
}));

router.patch('/:id/blacklist', asyncHandler(async (req, res) => {
  const p = await Passenger.findByIdAndUpdate(
    req.params.id,
    { isBlacklisted: req.body.isBlacklisted, blacklistReason: req.body.blacklistReason },
    { new: true }
  );
  if (!p) return sendError(res, 'Passenger not found', 404);
  return sendSuccess(res, p, 'Passenger blacklist status updated');
}));

router.get('/:id/bookings', asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ passenger: req.params.id })
    .populate('bus', 'busNumber from to')
    .populate('trip', 'travelDate departureTime')
    .sort({ createdAt: -1 });
  return sendSuccess(res, bookings);
}));

export default router;
