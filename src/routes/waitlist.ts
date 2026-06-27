import { Router } from 'express';
import Waitlist from '../models/Waitlist';
import SeatMap from '../models/SeatMap';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import mongoose from 'mongoose';

const router = Router();
router.use(protect);

router.post('/', asyncHandler(async (req, res) => {
  const { tripId, passengerId, seatsNeeded } = req.body;
  const existing = await Waitlist.findOne({ trip: tripId, passenger: passengerId, status: { $in: ['waiting', 'offered'] } });
  if (existing) return sendError(res, 'Passenger already on waitlist', 400);
  const last = await Waitlist.findOne({ trip: tripId }).sort({ position: -1 });
  const position = (last?.position || 0) + 1;
  const entry = await Waitlist.create({ trip: tripId, passenger: passengerId, seatsNeeded, position });
  return sendSuccess(res, entry, 'Added to waitlist', 201);
}));

router.get('/:tripId', asyncHandler(async (req, res) => {
  const list = await Waitlist.find({ trip: req.params.tripId })
    .populate('passenger', 'name phone')
    .sort({ position: 1 });
  return sendSuccess(res, list);
}));

router.patch('/:id/offer', asyncHandler(async (req, res) => {
  const entry = await Waitlist.findById(req.params.id);
  if (!entry) return sendError(res, 'Waitlist entry not found', 404);
  const { seatNumbers } = req.body as { seatNumbers: number[] };
  const seatMap = await SeatMap.findOne({ trip: entry.trip });
  if (seatMap) {
    seatMap.seats.forEach(s => {
      if (seatNumbers.includes(s.seatNumber)) {
        s.status = 'selected';
        s.heldBy = new mongoose.Types.ObjectId(req.user!.id);
        s.heldAt = new Date();
      }
    });
    await seatMap.save();
  }
  entry.status = 'offered';
  entry.offeredAt = new Date();
  entry.offeredSeats = seatNumbers;
  await entry.save();
  return sendSuccess(res, entry, 'Seats offered');
}));

router.patch('/:id/confirm', asyncHandler(async (req, res) => {
  const entry = await Waitlist.findById(req.params.id);
  if (!entry || entry.status !== 'offered') return sendError(res, 'Cannot confirm', 400);
  entry.status = 'confirmed';
  await entry.save();
  return sendSuccess(res, entry, 'Waitlist confirmed. Create a booking for these seats.');
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const entry = await Waitlist.findById(req.params.id);
  if (!entry) return sendError(res, 'Not found', 404);
  if (entry.status === 'offered') {
    const seatMap = await SeatMap.findOne({ trip: entry.trip });
    if (seatMap) {
      seatMap.seats.forEach(s => {
        if (entry.offeredSeats.includes(s.seatNumber)) { s.status = 'available'; s.heldBy = null; s.heldAt = null; }
      });
      await seatMap.save();
    }
  }
  entry.status = 'cancelled';
  await entry.save();
  return sendSuccess(res, entry, 'Waitlist entry cancelled');
}));

export default router;
