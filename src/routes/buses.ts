import { Router } from 'express';
import { body, query } from 'express-validator';
import Bus from '../models/Bus';
import { protect } from '../middleware/auth';
import { checkRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import Booking from '../models/Booking';

const router = Router();
router.use(protect);

router.post(
  '/',
  [
    body('busNumber').notEmpty(),
    body('from').notEmpty(),
    body('to').notEmpty(),
    body('departureTime').notEmpty(),
    body('busType').isIn(['AC Sleeper', 'Non-AC Sleeper', 'AC Seater', 'Non-AC Seater', 'AC Semi-Sleeper', 'Non-AC Semi-Sleeper']),
    body('totalSeats').isInt({ min: 1 }),
    body('operatorId').optional().isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const operatorId = req.user!.role === 'superadmin' && req.body.operatorId
      ? req.body.operatorId
      : req.user!.id;
    const bus = await Bus.create({ ...req.body, operator: operatorId });
    return sendSuccess(res, bus, 'Bus created', 201);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (req.user!.role !== 'superadmin') filter.operator = req.user!.id;
    else if (req.query.operatorId) filter.operator = req.query.operatorId;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.from) filter.from = req.query.from;
    if (req.query.to) filter.to = req.query.to;
    const buses = await Bus.find(filter).populate('operator', 'name phone');
    return sendSuccess(res, buses);
  })
);

router.get('/:id', asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id).populate('operator', 'name phone');
  if (!bus) return sendError(res, 'Bus not found', 404);
  return sendSuccess(res, bus);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) return sendError(res, 'Bus not found', 404);
  if (req.user!.role !== 'superadmin' && bus.operator.toString() !== req.user!.id)
    return sendError(res, 'Forbidden', 403);
  Object.assign(bus, req.body);
  await bus.save();
  return sendSuccess(res, bus, 'Bus updated');
}));

router.patch('/:id/toggle', asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) return sendError(res, 'Bus not found', 404);
  if (req.user!.role !== 'superadmin' && bus.operator.toString() !== req.user!.id)
    return sendError(res, 'Forbidden', 403);
  bus.isActive = !bus.isActive;
  await bus.save();
  return sendSuccess(res, bus, `Bus ${bus.isActive ? 'activated' : 'deactivated'}`);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) return sendError(res, 'Bus not found', 404);
  if (req.user!.role !== 'superadmin' && bus.operator.toString() !== req.user!.id)
    return sendError(res, 'Forbidden', 403);
  const activeBookings = await Booking.countDocuments({ bus: req.params.id, status: { $in: ['booked', 'confirmed'] } });
  if (activeBookings > 0) return sendError(res, 'Cannot delete bus with active bookings', 400);
  bus.isActive = false;
  (bus as unknown as Record<string, unknown>).deletedAt = new Date();
  await bus.save();
  return sendSuccess(res, null, 'Bus deleted');
}));

export default router;
