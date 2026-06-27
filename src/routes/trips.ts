import { Router } from 'express';
import { body } from 'express-validator';
import { addDays, getDay } from 'date-fns';
import Trip from '../models/Trip';
import Booking from '../models/Booking';
import Bus from '../models/Bus';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect);

router.post(
  '/',
  [
    body('busId').notEmpty(),
    body('travelDate').isISO8601(),
    body('departureTime').notEmpty(),
    body('farePerSeat').isNumeric(),
    body('recurrence').isIn(['once', 'daily', 'alternate', 'every3days', 'every4days', 'weekly']),
    body('operatorId').optional().isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { busId, travelDate, departureTime, farePerSeat, recurrence, recurringDays } = req.body;
    const bus = await Bus.findById(busId);
    if (!bus) return sendError(res, 'Bus not found', 404);
    if (req.user!.role !== 'superadmin' && bus.operator.toString() !== req.user!.id)
      return sendError(res, 'Forbidden', 403);

    const tripOperatorId = req.user!.role === 'superadmin' && req.body.operatorId
      ? req.body.operatorId
      : req.user!.id;

    const trips = [];
    const base = { bus: busId, operator: tripOperatorId, departureTime, farePerSeat, recurrence, recurringDays: recurringDays || [] };

    const stepMap: Record<string, number> = { daily: 1, alternate: 2, every3days: 3, every4days: 4 };

    if (recurrence === 'once') {
      trips.push({ ...base, travelDate: new Date(travelDate) });
    } else if (stepMap[recurrence]) {
      let current = new Date(travelDate);
      const end = addDays(current, 30);
      const step = stepMap[recurrence];
      while (current <= end) {
        trips.push({ ...base, travelDate: new Date(current) });
        current = addDays(current, step);
      }
    } else {
      let current = new Date(travelDate);
      const end = addDays(current, 30);
      while (current <= end) {
        if ((recurringDays || []).includes(getDay(current))) {
          trips.push({ ...base, travelDate: new Date(current) });
        }
        current = addDays(current, 1);
      }
    }

    const created = await Trip.insertMany(trips);
    return sendSuccess(res, created, 'Trip(s) created', 201);
  })
);

router.post('/:id/clone', asyncHandler(async (req, res) => {
  const original = await Trip.findById(req.params.id);
  if (!original) return sendError(res, 'Trip not found', 404);
  const newDate = addDays(new Date(original.travelDate), 1);
  const cloned = await Trip.create({
    bus: original.bus, operator: req.user!.role === 'superadmin' ? original.operator : req.user!.id,
    travelDate: newDate, departureTime: original.departureTime,
    farePerSeat: original.farePerSeat, recurrence: 'once',
  });
  return sendSuccess(res, cloned, 'Trip cloned', 201);
}));

router.get('/', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  const role = req.user!.role;
  // ?allTrips=true lets conductors/drivers browse all trips for walk-in booking
  const skipRoleFilter = req.query.allTrips === 'true' && (role === 'conductor' || role === 'driver');
  if (!skipRoleFilter) {
    if (role === 'conductor') filter.conductor = req.user!.id;
    else if (role === 'driver') filter.driver = req.user!.id;
    else if (role !== 'superadmin') filter.operator = req.user!.id;
  }
  if (req.query.busId) filter.bus = req.query.busId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) filter.travelDate = new Date(req.query.date as string);
  if (req.user!.role === 'superadmin' && req.query.operatorId) filter.operator = req.query.operatorId;
  const trips = await Trip.find(filter).populate('bus', 'busNumber from to busType totalSeats').sort({ travelDate: 1 });
  const tripIds = trips.map(t => t._id);
  const [bookingCounts, boardingCounts] = await Promise.all([
    Booking.aggregate([
      { $match: { trip: { $in: tripIds }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$trip', bookedSeats: { $sum: { $size: '$seats' } } } },
    ]),
    Booking.aggregate([
      { $match: { trip: { $in: tripIds }, status: 'boarded' } },
      { $group: { _id: '$trip', boardedSeats: { $sum: { $size: '$seats' } } } },
    ]),
  ]);
  const bookedMap: Record<string, number> = {};
  const boardedMap: Record<string, number> = {};
  bookingCounts.forEach((b: { _id: string; bookedSeats: number }) => { bookedMap[String(b._id)] = b.bookedSeats; });
  boardingCounts.forEach((b: { _id: string; boardedSeats: number }) => { boardedMap[String(b._id)] = b.boardedSeats; });
  const result = trips.map(t => ({
    ...t.toObject(),
    bookedSeats: bookedMap[String(t._id)] ?? 0,
    boardedSeats: boardedMap[String(t._id)] ?? 0,
  }));
  return sendSuccess(res, result);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id)
    .populate('bus')
    .populate('operator', 'name phone')
    .populate('conductor', 'name phone')
    .populate('driver', 'name phone');
  if (!trip) return sendError(res, 'Trip not found', 404);
  return sendSuccess(res, trip);
}));

router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return sendError(res, 'Trip not found', 404);
  if (trip.status !== 'upcoming') return sendError(res, 'Trip is not in upcoming status', 400);
  const role = req.user!.role;
  const isAssigned =
    role === 'conductor' ? trip.conductor?.toString() === req.user!.id :
    role === 'driver'    ? trip.driver?.toString()    === req.user!.id :
    ['superadmin', 'operator'].includes(role);
  if (!isAssigned) return sendError(res, 'Not assigned to this trip', 403);
  trip.status = 'completed';
  await trip.save();
  return sendSuccess(res, trip, 'Trip marked as completed');
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return sendError(res, 'Trip not found', 404);
  if (trip.status !== 'upcoming') return sendError(res, 'Trip already completed or cancelled', 400);
  trip.status = 'cancelled';
  trip.cancelReason = req.body.cancelReason;
  await trip.save();
  return sendSuccess(res, trip, 'Trip cancelled');
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return sendError(res, 'Trip not found', 404);
  if (trip.status !== 'upcoming') return sendError(res, 'Cannot edit completed or cancelled trip', 400);
  if (req.body.farePerSeat) trip.farePerSeat = req.body.farePerSeat;
  if (req.body.departureTime) trip.departureTime = req.body.departureTime;
  await trip.save();
  return sendSuccess(res, trip, 'Trip updated');
}));

// PATCH /api/trips/:id/assign-staff — assign conductor and/or driver to a trip
router.patch('/:id/assign-staff', asyncHandler(async (req, res) => {
  if (!['superadmin', 'operator'].includes(req.user!.role))
    return sendError(res, 'Forbidden', 403);
  const trip = await Trip.findById(req.params.id);
  if (!trip) return sendError(res, 'Trip not found', 404);
  if (req.body.conductorId !== undefined) trip.conductor = req.body.conductorId || undefined;
  if (req.body.driverId !== undefined) trip.driver = req.body.driverId || undefined;
  await trip.save();
  return sendSuccess(res, trip, 'Staff assigned');
}));

export default router;
