import { Router } from 'express';
import Booking from '../models/Booking';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import mongoose from 'mongoose';

const router = Router();
router.use(protect);

const operatorMatch = (userId: string, role: string, operatorId?: string) => {
  if (role === 'superadmin' && operatorId) return { operator: new mongoose.Types.ObjectId(operatorId) };
  if (role !== 'superadmin') return { operator: new mongoose.Types.ObjectId(userId) };
  return {};
};

router.get('/summary', asyncHandler(async (req, res) => {
  const match: Record<string, unknown> = { ...operatorMatch(req.user!.id, req.user!.role, req.query.operatorId as string) };
  if (req.query.from) match.createdAt = { $gte: new Date(req.query.from as string) };
  if (req.query.to) match.createdAt = { ...(match.createdAt as object || {}), $lte: new Date(req.query.to as string) };

  const [stats] = await Booking.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$finalFare' },
        totalCancellations: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        collectedCash: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$amountPaid', 0] } },
        collectedUPI: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$amountPaid', 0] } },
        pendingAmount: { $sum: '$balanceDue' },
      },
    },
  ]);
  const totalPassengers = await Booking.distinct('passenger', match);
  return sendSuccess(res, { ...stats, totalPassengers: totalPassengers.length, cancellationRate: stats ? Math.round((stats.totalCancellations / stats.totalBookings) * 100) : 0 });
}));

router.get('/daily', asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days as string || '7'), 90);
  const from = new Date(); from.setDate(from.getDate() - days);
  const match = { ...operatorMatch(req.user!.id, req.user!.role, req.query.operatorId as string), createdAt: { $gte: from } };
  const data = await Booking.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, bookings: { $sum: 1 }, revenue: { $sum: '$finalFare' }, cancellations: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  return sendSuccess(res, data);
}));

router.get('/routes', asyncHandler(async (req, res) => {
  const match = operatorMatch(req.user!.id, req.user!.role, req.query.operatorId as string);
  const data = await Booking.aggregate([
    { $match: match },
    { $lookup: { from: 'buses', localField: 'bus', foreignField: '_id', as: 'busInfo' } },
    { $unwind: '$busInfo' },
    {
      $group: {
        _id: { from: '$busInfo.from', to: '$busInfo.to' },
        totalPassengers: { $sum: { $size: '$seats' } },
        totalRevenue: { $sum: '$finalFare' },
        totalTrips: { $addToSet: '$trip' },
      },
    },
    { $project: { from: '$_id.from', to: '$_id.to', totalPassengers: 1, totalRevenue: 1, totalTrips: { $size: '$totalTrips' }, _id: 0 } },
  ]);
  return sendSuccess(res, data);
}));

router.get('/occupancy', asyncHandler(async (req, res) => {
  const match: Record<string, unknown> = { ...operatorMatch(req.user!.id, req.user!.role) };
  if (req.query.busId) match.bus = new mongoose.Types.ObjectId(req.query.busId as string);
  const data = await Booking.aggregate([
    { $match: match },
    { $lookup: { from: 'trips', localField: 'trip', foreignField: '_id', as: 'tripInfo' } },
    { $unwind: '$tripInfo' },
    { $lookup: { from: 'buses', localField: 'bus', foreignField: '_id', as: 'busInfo' } },
    { $unwind: '$busInfo' },
    { $group: { _id: '$trip', date: { $first: '$tripInfo.travelDate' }, totalSeats: { $first: '$busInfo.totalSeats' }, bookedSeats: { $sum: { $size: '$seats' } } } },
    { $project: { tripId: '$_id', date: 1, totalSeats: 1, bookedSeats: 1, occupancy: { $multiply: [{ $divide: ['$bookedSeats', '$totalSeats'] }, 100] }, _id: 0 } },
    { $sort: { date: -1 } },
  ]);
  return sendSuccess(res, data);
}));

router.get('/peak-days', asyncHandler(async (req, res) => {
  const match: Record<string, unknown> = { ...operatorMatch(req.user!.id, req.user!.role) };
  if (req.query.routeFrom || req.query.routeTo) {
    // filter by route via lookup — simplified here
  }
  const data = await Booking.aggregate([
    { $match: match },
    { $group: { _id: { $dayOfWeek: '$createdAt' }, totalBookings: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return sendSuccess(res, data.map(d => ({ day: days[(d._id - 1)], totalBookings: d.totalBookings })));
}));

router.get('/operators', asyncHandler(async (req, res) => {
  const data = await Booking.aggregate([
    { $group: { _id: '$operator', totalBookings: { $sum: 1 }, totalRevenue: { $sum: '$finalFare' } } },
    { $lookup: { from: 'operators', localField: '_id', foreignField: '_id', as: 'op' } },
    { $unwind: '$op' },
    { $project: { name: '$op.name', phone: '$op.phone', commissionRate: '$op.commissionRate', totalBookings: 1, totalRevenue: 1, commission: { $multiply: ['$totalRevenue', { $divide: ['$op.commissionRate', 100] }] } } },
  ]);
  return sendSuccess(res, data);
}));

export default router;
