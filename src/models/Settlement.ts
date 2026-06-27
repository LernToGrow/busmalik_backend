import mongoose, { Document, Schema } from 'mongoose';

export interface ISettlement extends Document {
  trip: mongoose.Types.ObjectId;
  conductor: mongoose.Types.ObjectId;
  operator: mongoose.Types.ObjectId;
  cashAmount: number;
  upiAmount: number;
  totalAmount: number;
  status: 'submitted' | 'confirmed';
  note?: string;
  confirmedAt?: Date;
}

const SettlementSchema = new Schema<ISettlement>(
  {
    trip:        { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
    conductor:   { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
    operator:    { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
    cashAmount:  { type: Number, required: true, default: 0 },
    upiAmount:   { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    status:      { type: String, enum: ['submitted', 'confirmed'], default: 'submitted' },
    note:        { type: String },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<ISettlement>('Settlement', SettlementSchema);
