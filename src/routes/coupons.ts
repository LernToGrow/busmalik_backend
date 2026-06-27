import { Router } from 'express';
import { body } from 'express-validator';
import Coupon from '../models/Coupon';
import { protect } from '../middleware/auth';
import { checkRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
router.use(protect);

router.post(
  '/',
  checkRole('superadmin'),
  [body('code').notEmpty(), body('discountType').isIn(['flat', 'percentage']), body('discountValue').isNumeric(), body('expiryDate').isISO8601()],
  validate,
  asyncHandler(async (req, res) => {
    const c = await Coupon.create({ ...req.body, code: req.body.code.toUpperCase(), createdBy: req.user!.id });
    return sendSuccess(res, c, 'Coupon created', 201);
  })
);

router.get('/', checkRole('superadmin'), asyncHandler(async (req, res) => {
  const coupons = await Coupon.find();
  return sendSuccess(res, coupons);
}));

router.post('/validate', asyncHandler(async (req, res) => {
  const { code, bookingAmount } = req.body;
  const coupon = await Coupon.findOne({ code: code?.toUpperCase(), isActive: true });
  if (!coupon) return sendSuccess(res, { valid: false, message: 'Invalid coupon' });
  if (new Date() > coupon.expiryDate) return sendSuccess(res, { valid: false, message: 'Coupon expired' });
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return sendSuccess(res, { valid: false, message: 'Coupon exhausted' });
  if (bookingAmount < coupon.minBookingAmount) return sendSuccess(res, { valid: false, message: `Min booking ₹${coupon.minBookingAmount}` });
  const discountAmount = coupon.discountType === 'flat' ? coupon.discountValue : Math.round(bookingAmount * coupon.discountValue / 100);
  return sendSuccess(res, { valid: true, discountAmount, finalAmount: bookingAmount - discountAmount, message: 'Coupon applied' });
}));

router.patch('/:id/toggle', checkRole('superadmin'), asyncHandler(async (req, res) => {
  const c = await Coupon.findById(req.params.id);
  if (!c) return sendError(res, 'Coupon not found', 404);
  c.isActive = !c.isActive;
  await c.save();
  return sendSuccess(res, c);
}));

router.delete('/:id', checkRole('superadmin'), asyncHandler(async (req, res) => {
  const c = await Coupon.findById(req.params.id);
  if (!c) return sendError(res, 'Coupon not found', 404);
  if (c.usedCount > 0) return sendError(res, 'Cannot delete a used coupon. Disable it instead.', 400);
  await c.deleteOne();
  return sendSuccess(res, null, 'Coupon deleted');
}));

export default router;
