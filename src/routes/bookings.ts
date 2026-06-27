import { Router } from 'express';
import SeatMap from '../models/SeatMap';
import Booking from '../models/Booking';
import Trip from '../models/Trip';
import Bus from '../models/Bus';
import Coupon from '../models/Coupon';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { calculateRefund } from '../utils/policy';
import { sendTemplatedSMS } from '../utils/sms';
import mongoose from 'mongoose';

const router = Router();
router.use(protect);

const getOrCreateSeatMap = async (tripId: string) => {
  let seatMap = await SeatMap.findOne({ trip: tripId });
  if (!seatMap) {
    const trip = await Trip.findById(tripId).populate<{ bus: { _id: mongoose.Types.ObjectId; totalSeats: number } }>('bus');
    if (!trip) return null;
    const busDoc = trip.bus as { _id: mongoose.Types.ObjectId; totalSeats: number };
    const seats = Array.from({ length: busDoc.totalSeats }, (_, i) => ({
      seatNumber: i + 1, status: 'available' as const, bookingId: null, heldBy: null, heldAt: null,
    }));
    seatMap = await SeatMap.create({ trip: tripId, bus: busDoc._id, seats });
  }
  // Release seats held > 15 minutes
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  seatMap.seats.forEach(s => {
    if (s.status === 'selected' && s.heldAt && s.heldAt < cutoff) {
      s.status = 'available';
      s.heldBy = null;
      s.heldAt = null;
    }
  });
  await seatMap.save();
  return seatMap;
};

// GET /api/trips/:tripId/seatmap
router.get('/:tripId/seatmap', asyncHandler(async (req, res) => {
  const seatMap = await getOrCreateSeatMap(req.params['tripId'] as string);
  if (!seatMap) return sendError(res, 'Trip not found', 404);
  return sendSuccess(res, seatMap);
}));

// PATCH /api/trips/:tripId/seatmap/hold
router.patch('/:tripId/seatmap/hold', asyncHandler(async (req, res) => {
  const { seatNumbers } = req.body as { seatNumbers: number[] };
  const seatMap = await getOrCreateSeatMap(req.params['tripId'] as string);
  if (!seatMap) return sendError(res, 'Trip not found', 404);
  for (const n of seatNumbers) {
    const seat = seatMap.seats.find(s => s.seatNumber === n);
    if (!seat || seat.status !== 'available') return sendError(res, `Seat ${n} is not available`, 400);
  }
  seatMap.seats.forEach(s => {
    if (seatNumbers.includes(s.seatNumber)) {
      s.status = 'selected';
      s.heldBy = new mongoose.Types.ObjectId(req.user!.id);
      s.heldAt = new Date();
    }
  });
  await seatMap.save();
  return sendSuccess(res, seatMap);
}));

// POST /api/bookings
router.post('/', asyncHandler(async (req, res) => {
  const { tripId, passengerId, seats, paymentMethod, amountPaid, couponCode, farePerSeat, fromStop, toStop } = req.body;
  const seatMap = await getOrCreateSeatMap(tripId);
  if (!seatMap) return sendError(res, 'Trip not found', 404);

  for (const n of seats as number[]) {
    const s = seatMap.seats.find(seat => seat.seatNumber === n);
    if (!s || (s.status !== 'available' && s.status !== 'selected')) return sendError(res, `Seat ${n} not available`, 400);
  }

  let discountAmount = 0;
  let couponUsed = '';
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (coupon && new Date() < coupon.expiryDate && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      const total = farePerSeat * seats.length;
      if (total >= coupon.minBookingAmount) {
        discountAmount = coupon.discountType === 'flat' ? coupon.discountValue : Math.round(total * coupon.discountValue / 100);
        coupon.usedCount += 1;
        await coupon.save();
        couponUsed = coupon.code;
      }
    }
  }

  const totalFare = farePerSeat * (seats as number[]).length;
  const finalFare = Math.max(0, totalFare - discountAmount);
  const balanceDue = Math.max(0, finalFare - amountPaid);
  const paymentStatus = balanceDue === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

  const bookingId = 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const trip = await Trip.findById(tripId).populate<{ bus: { _id: mongoose.Types.ObjectId; busNumber: string; from: string; to: string } }>('bus');
  // If a conductor is creating the booking, attribute it to the trip's operator
  const bookingOperator = (req.user!.role === 'conductor' || req.user!.role === 'driver')
    ? trip!.operator
    : req.user!.id;
  const booking = await Booking.create({
    bookingId, trip: tripId, bus: trip!.bus._id, passenger: passengerId, operator: bookingOperator,
    seats, totalFare, discountAmount, finalFare, paymentMethod, amountPaid, balanceDue,
    upiRef: req.body.upiRef, paymentStatus, status: 'confirmed', couponCode: couponUsed || undefined,
    fromStop: fromStop || undefined, toStop: toStop || undefined,
  });

  seatMap.seats.forEach(s => {
    if ((seats as number[]).includes(s.seatNumber)) {
      s.status = 'confirmed';
      s.bookingId = booking._id as mongoose.Types.ObjectId;
    }
  });
  await seatMap.save();

  return sendSuccess(res, booking, 'Booking confirmed', 201);
}));

// GET /api/bookings
router.get('/', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  const role = req.user!.role;

  // Conductors and drivers can read bookings for their assigned trips only
  if (role === 'conductor' || role === 'driver') {
    if (!req.query.tripId) return sendError(res, 'tripId is required for this role', 400);
    // Verify they are assigned to this trip
    const trip = await Trip.findById(req.query.tripId as string);
    if (!trip) return sendError(res, 'Trip not found', 404);
    const assignedId = role === 'conductor' ? trip.conductor?.toString() : trip.driver?.toString();
    if (assignedId !== req.user!.id) return sendError(res, 'Not assigned to this trip', 403);
  } else if (role !== 'superadmin') {
    filter.operator = req.user!.id;
  }

  if (req.query.tripId) filter.trip = req.query.tripId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.busId) filter.bus = req.query.busId;
  if (req.query.passengerId) filter.passenger = req.query.passengerId;
  if (req.query.paymentStatus) filter.paymentStatus = { $in: (req.query.paymentStatus as string).split(',') };
  if (req.query.search) filter.bookingId = new RegExp(req.query.search as string, 'i');
  if (role === 'superadmin' && req.query.operatorId) filter.operator = req.query.operatorId;

  const bookings = await Booking.find(filter)
    .populate('passenger', 'name phone')
    .populate('bus', 'busNumber from to')
    .populate('trip', 'travelDate departureTime')
    .sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, bookings);
}));

// GET /api/bookings/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('passenger')
    .populate('bus')
    .populate('trip')
    .populate('operator', 'name phone');
  if (!booking) return sendError(res, 'Booking not found', 404);
  return sendSuccess(res, booking);
}));

// PATCH /api/bookings/:id/payment
router.patch('/:id/payment', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return sendError(res, 'Booking not found', 404);
  booking.amountPaid = req.body.amountPaid;
  booking.paymentMethod = req.body.paymentMethod;
  if (req.body.upiRef) booking.upiRef = req.body.upiRef;
  booking.balanceDue = Math.max(0, booking.finalFare - booking.amountPaid);
  booking.paymentStatus = booking.balanceDue === 0 ? 'paid' : booking.amountPaid > 0 ? 'partial' : 'pending';
  await booking.save();
  return sendSuccess(res, booking, 'Payment updated');
}));

// PATCH /api/bookings/:id/cancel
router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return sendError(res, 'Booking not found', 404);
  const trip = await Trip.findById(booking.trip);
  if (!trip) return sendError(res, 'Trip not found', 404);
  const refundAmount = await calculateRefund(booking, trip);
  booking.status = 'cancelled';
  booking.cancelReason = req.body.cancelReason;
  booking.refundAmount = refundAmount;
  await booking.save();
  const seatMap = await SeatMap.findOne({ trip: booking.trip });
  if (seatMap) {
    seatMap.seats.forEach(s => {
      if (booking.seats.includes(s.seatNumber)) { s.status = 'available'; s.bookingId = null; }
    });
    await seatMap.save();
  }
  return sendSuccess(res, { booking, refundAmount }, 'Booking cancelled');
}));

// PATCH /api/bookings/:id/board
router.patch('/:id/board', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return sendError(res, 'Booking not found', 404);
  if (booking.status !== 'confirmed') return sendError(res, 'Booking is not confirmed', 400);
  if (booking.boardedAt) return sendError(res, 'Already boarded', 400);
  booking.status = 'boarded';
  booking.boardedAt = new Date();
  await booking.save();
  return sendSuccess(res, booking, 'Passenger boarded');
}));

// POST /api/bookings/:id/notify
router.post('/:id/notify', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate<{
    passenger: { name: string; phone: string };
    bus: { busNumber: string; from: string; to: string };
    trip: { travelDate: Date; departureTime: string };
  }>('passenger bus trip');
  if (!booking) return sendError(res, 'Booking not found', 404);
  const { templateKey } = req.body;
  const result = await sendTemplatedSMS(
    booking.passenger.phone, templateKey,
    {
      name: booking.passenger.name, bookingId: booking.bookingId,
      busNo: booking.bus.busNumber, seats: booking.seats.join(', '),
      date: booking.trip.travelDate.toDateString(),
      from: booking.bus.from, to: booking.bus.to,
      time: booking.trip.departureTime,
      refundAmount: String(booking.refundAmount || 0),
      amount: String(booking.balanceDue),
    },
    booking._id as mongoose.Types.ObjectId
  );
  return sendSuccess(res, result, 'SMS sent');
}));

export default router;
