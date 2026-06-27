import mongoose, { Document, Schema } from 'mongoose';

export interface IPayout extends Document {
  operator: mongoose.Types.ObjectId;
  month: string;
  totalRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'paid';
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
}

const PayoutSchema = new Schema<IPayout>({
  operator: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
  month: { type: String, required: true },
  totalRevenue: { type: Number, required: true },
  commissionRate: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paidAt: { type: Date },
  paidBy: { type: Schema.Types.ObjectId, ref: 'Operator' },
  note: { type: String },
}, { timestamps: true });

export default mongoose.model<IPayout>('Payout', PayoutSchema);
