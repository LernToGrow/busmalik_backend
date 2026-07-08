import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Operator from '../models/Operator';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { env } from '../config/env';

const router = Router();

const signToken = (op: { _id: unknown; name: string; role: string; phone: string }) =>
  jwt.sign({ id: op._id, name: op.name, role: op.role, phone: op.phone }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

// POST /api/auth/setup — operator signup
router.post(
  '/setup',
  [body('name').notEmpty(), body('phone').isLength({ min: 10, max: 10 }), body('pin').isLength({ min: 4, max: 4 })],
  validate,
  asyncHandler(async (req, res) => {
    const { name, phone, pin } = req.body;
    const hashed = await bcrypt.hash(pin, 10);
    const op = await Operator.create({ name, phone, pin: hashed, role: 'operator' });
    const token = signToken(op);
    return sendSuccess(res, { token, operator: { id: op._id, name: op.name, role: op.role } }, 'Operator created', 201);
  })
);

// POST /api/auth/login
router.post(
  '/login',
  [body('phone').notEmpty(), body('pin').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { phone, pin } = req.body;
    const op = await Operator.findOne({ phone, isActive: true });
    if (!op) return sendError(res, 'Invalid phone or PIN', 401);
    const match = await bcrypt.compare(pin, op.pin);
    if (!match) return sendError(res, 'Invalid phone or PIN', 401);
    const token = signToken(op);
    return sendSuccess(res, { token, operator: { id: op._id, name: op.name, role: op.role, phone: op.phone } });
  })
);

// GET /api/auth/me
router.get('/me', protect, asyncHandler(async (req, res) => {
  const op = await Operator.findById(req.user!.id).select('-pin');
  if (!op) return sendError(res, 'Not found', 404);
  return sendSuccess(res, op);
}));

// PATCH /api/auth/profile
router.patch(
  '/profile',
  protect,
  [body('name').notEmpty().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    const op = await Operator.findByIdAndUpdate(
      req.user!.id,
      { name },
      { new: true }
    ).select('-pin');
    if (!op) return sendError(res, 'Not found', 404);
    const token = signToken(op);
    return sendSuccess(res, { token, operator: { id: op._id, name: op.name, role: op.role, phone: op.phone } }, 'Profile updated');
  })
);

// POST /api/auth/change-pin
router.post(
  '/change-pin',
  protect,
  [body('currentPin').notEmpty(), body('newPin').isLength({ min: 4, max: 4 })],
  validate,
  asyncHandler(async (req, res) => {
    const { currentPin, newPin } = req.body;
    const op = await Operator.findById(req.user!.id);
    if (!op) return sendError(res, 'Not found', 404);
    const match = await bcrypt.compare(currentPin, op.pin);
    if (!match) return sendError(res, 'Current PIN is incorrect', 400);
    op.pin = await bcrypt.hash(newPin, 10);
    await op.save();
    return sendSuccess(res, null, 'PIN updated');
  })
);

export default router;
