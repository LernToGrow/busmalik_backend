import { Router } from 'express';
import Settings from '../models/Settings';
import Booking from '../models/Booking';
import Trip from '../models/Trip';
import { protect } from '../middleware/auth';
import { checkRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { calculateRefund } from '../utils/policy';

const router = Router();
router.use(protect);

router.get('/:key', asyncHandler(async (req, res) => {
  const s = await Settings.findOne({ key: req.params.key });
  if (!s) return sendError(res, 'Setting not found', 404);
  return sendSuccess(res, s.value);
}));

router.put('/:key', checkRole('superadmin'), asyncHandler(async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    { key: req.params.key },
    { value: req.body.value, updatedBy: req.user!.id },
    { upsert: true, new: true }
  );
  return sendSuccess(res, s, 'Setting updated');
}));

router.get('/cancellation-preview', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.query.bookingId);
  if (!booking) return sendError(res, 'Booking not found', 404);
  const trip = await Trip.findById(booking.trip);
  if (!trip) return sendError(res, 'Trip not found', 404);
  const departure = new Date(`${trip.travelDate.toISOString().split('T')[0]}T${trip.departureTime}`);
  const now = req.query.cancelledAt ? new Date(req.query.cancelledAt as string) : new Date();
  const hoursUntilDeparture = Math.round((departure.getTime() - now.getTime()) / (1000 * 60 * 60));
  const refundAmount = await calculateRefund(booking, trip);
  const refundPercent = booking.finalFare > 0 ? Math.round((refundAmount / booking.finalFare) * 100) : 0;
  return sendSuccess(res, { hoursUntilDeparture, refundPercent, refundAmount });
}));

export default router;
