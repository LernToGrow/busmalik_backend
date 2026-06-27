import { Router } from 'express';
import Settlement from '../models/Settlement';
import Trip from '../models/Trip';
import Booking from '../models/Booking';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect);

// POST /api/settlements — conductor submits collected cash for a trip
router.post('/', asyncHandler(async (req, res) => {
  const { role, id: conductorId } = req.user!;
  if (role !== 'conductor') return sendError(res, 'Only conductors can submit settlements', 403);

  const { tripId, note } = req.body;
  if (!tripId) return sendError(res, 'tripId is required', 400);

  const trip = await Trip.findById(tripId);
  if (!trip) return sendError(res, 'Trip not found', 404);
  if (trip.conductor?.toString() !== conductorId)
    return sendError(res, 'Not assigned to this trip', 403);

  const existing = await Settlement.findOne({ trip: tripId });
  if (existing) return sendError(res, 'Settlement already submitted for this trip', 409);

  // Aggregate collected amounts from bookings
  const [cashAgg, upiAgg] = await Promise.all([
    Booking.aggregate([
      { $match: { trip: trip._id, paymentMethod: 'cash', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]),
    Booking.aggregate([
      { $match: { trip: trip._id, paymentMethod: 'upi', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]),
  ]);

  const cashAmount = cashAgg[0]?.total ?? 0;
  const upiAmount  = upiAgg[0]?.total ?? 0;

  const settlement = await Settlement.create({
    trip: tripId,
    conductor: conductorId,
    operator: trip.operator,
    cashAmount,
    upiAmount,
    totalAmount: cashAmount + upiAmount,
    note,
  });

  return sendSuccess(res, settlement, 'Settlement submitted', 201);
}));

// GET /api/settlements — conductor: own; operator/superadmin: their conductors'
router.get('/', asyncHandler(async (req, res) => {
  const { role, id } = req.user!;
  const filter: Record<string, unknown> = {};

  if (role === 'conductor') {
    filter.conductor = id;
  } else if (role === 'operator') {
    filter.operator = id;
  }
  // superadmin sees all (no filter)

  const settlements = await Settlement.find(filter)
    .populate('trip', 'travelDate departureTime')
    .populate('conductor', 'name phone')
    .populate('operator', 'name')
    .sort({ createdAt: -1 });

  return sendSuccess(res, settlements);
}));

// PATCH /api/settlements/:id/confirm — operator confirms receipt
router.patch('/:id/confirm', asyncHandler(async (req, res) => {
  const { role, id: operatorId } = req.user!;
  if (!['operator', 'superadmin'].includes(role))
    return sendError(res, 'Forbidden', 403);

  const settlement = await Settlement.findById(req.params.id);
  if (!settlement) return sendError(res, 'Settlement not found', 404);
  if (role === 'operator' && settlement.operator.toString() !== operatorId)
    return sendError(res, 'Forbidden', 403);
  if (settlement.status === 'confirmed')
    return sendError(res, 'Already confirmed', 400);

  settlement.status = 'confirmed';
  settlement.confirmedAt = new Date();
  await settlement.save();

  return sendSuccess(res, settlement, 'Settlement confirmed');
}));

export default router;
