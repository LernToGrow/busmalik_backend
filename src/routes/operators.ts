import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcrypt';
import Operator from '../models/Operator';
import Bus from '../models/Bus';
import Booking from '../models/Booking';
import Payout from '../models/Payout';
import { protect } from '../middleware/auth';
import { checkRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect);

// GET /api/operators — readable by superadmin and operator (for assign-staff modal)
router.get('/', checkRole('superadmin', 'operator'), asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.role) filter.role = req.query.role;
  // Operators see their assigned staff + legacy unassigned staff (no assignedOperator field)
  if (req.user!.role === 'operator') {
    if (!req.query.role) filter.role = { $in: ['conductor', 'driver'] };
    filter.$or = [
      { assignedOperator: req.user!.id },
      { assignedOperator: { $exists: false } },
      { assignedOperator: null },
    ];
  }
  const operators = await Operator.find(filter).select('-pin').populate('assignedOperator', 'name');
  return sendSuccess(res, operators);
}));

// All write operations remain superadmin-only
const adminOnly = checkRole('superadmin');

router.post(
  '/',
  checkRole('superadmin', 'operator'),
  [
    body('name').notEmpty(),
    body('phone').isLength({ min: 10, max: 10 }),
    body('pin').isLength({ min: 4, max: 4 }),
    body('role').optional().isIn(['operator', 'conductor', 'driver']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { role: requesterRole, id: requesterId } = req.user!;
    const targetRole = req.body.role ?? 'operator';

    // Operators can only create conductors and drivers, not other operators
    if (requesterRole === 'operator' && !['conductor', 'driver'].includes(targetRole))
      return sendError(res, 'Operators can only create conductors or drivers', 403);

    const hashed = await bcrypt.hash(req.body.pin, 10);
    const op = await Operator.create({
      ...req.body,
      pin: hashed,
      // Link conductor/driver back to the creating operator
      assignedOperator: requesterRole === 'operator' ? requesterId : req.body.assignedOperator,
    });
    const { pin: _, ...safe } = op.toObject();
    return sendSuccess(res, safe, 'Staff created', 201);
  })
);

router.get('/:id', adminOnly, asyncHandler(async (req, res) => {
  const op = await Operator.findById(req.params.id).select('-pin');
  if (!op) return sendError(res, 'Not found', 404);
  const totalBuses = await Bus.countDocuments({ operator: req.params.id, isActive: true });
  return sendSuccess(res, { ...op.toObject(), totalBuses });
}));

router.put('/:id', checkRole('superadmin', 'operator'), asyncHandler(async (req, res) => {
  const op = await Operator.findById(req.params.id);
  if (!op) return sendError(res, 'Not found', 404);
  const assignedTo = op.assignedOperator?.toString();
  if (req.user!.role === 'operator' && assignedTo && assignedTo !== req.user!.id)
    return sendError(res, 'Forbidden', 403);
  const { pin, role, ...update } = req.body;
  const updated = await Operator.findByIdAndUpdate(req.params.id, update, { new: true }).select('-pin');
  return sendSuccess(res, updated, 'Staff updated');
}));

router.post('/:id/reset-pin', checkRole('superadmin', 'operator'), [body('newPin').isLength({ min: 4, max: 4 })], validate, asyncHandler(async (req, res) => {
  const op = await Operator.findById(req.params.id);
  if (!op) return sendError(res, 'Not found', 404);
  const assignedToR = op.assignedOperator?.toString();
  if (req.user!.role === 'operator' && assignedToR && assignedToR !== req.user!.id)
    return sendError(res, 'Forbidden', 403);
  op.pin = await bcrypt.hash(req.body.newPin, 10);
  await op.save();
  return sendSuccess(res, null, 'PIN reset');
}));

router.patch('/:id/toggle', checkRole('superadmin', 'operator'), asyncHandler(async (req, res) => {
  const op = await Operator.findById(req.params.id);
  if (!op) return sendError(res, 'Not found', 404);
  const assignedToT = op.assignedOperator?.toString();
  if (req.user!.role === 'operator' && assignedToT && assignedToT !== req.user!.id)
    return sendError(res, 'Forbidden', 403);
  op.isActive = !op.isActive;
  await op.save();
  if (!op.isActive) await Bus.updateMany({ operator: req.params.id }, { isActive: false });
  return sendSuccess(res, op, `Operator ${op.isActive ? 'activated' : 'deactivated'}`);
}));

router.post('/:id/payouts', adminOnly, asyncHandler(async (req, res) => {
  const { month } = req.body;
  const [year, m] = month.split('-').map(Number);
  const from = new Date(year, m - 1, 1);
  const to = new Date(year, m, 0, 23, 59, 59);
  const op = await Operator.findById(req.params.id);
  if (!op) return sendError(res, 'Not found', 404);
  const [agg] = await Booking.aggregate([
    { $match: { operator: op._id, createdAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalRevenue: { $sum: '$finalFare' } } },
  ]);
  const totalRevenue = agg?.totalRevenue || 0;
  const commissionAmount = Math.round(totalRevenue * op.commissionRate / 100);
  const payout = await Payout.create({ operator: op._id, month, totalRevenue, commissionRate: op.commissionRate, commissionAmount });
  return sendSuccess(res, payout, 'Payout generated', 201);
}));

router.get('/:id/payouts', adminOnly, asyncHandler(async (req, res) => {
  const payouts = await Payout.find({ operator: req.params['id'] as string }).sort({ createdAt: -1 });
  return sendSuccess(res, payouts);
}));

export default router;
