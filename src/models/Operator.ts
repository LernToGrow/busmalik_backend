import mongoose, { Document, Schema } from 'mongoose';

export interface IOperator extends Document {
  name: string;
  phone: string;
  pin: string;
  role: 'superadmin' | 'operator' | 'conductor' | 'driver';
  assignedOperator?: mongoose.Types.ObjectId;
  commissionRate: number;
  isActive: boolean;
  createdAt: Date;
}

const OperatorSchema = new Schema<IOperator>({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'operator', 'conductor', 'driver'], default: 'operator' },
  assignedOperator: { type: Schema.Types.ObjectId, ref: 'Operator' },
  commissionRate: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IOperator>('Operator', OperatorSchema);
