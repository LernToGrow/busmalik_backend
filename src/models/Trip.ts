import mongoose, { Document, Schema } from 'mongoose';

export interface ITrip extends Document {
  bus: mongoose.Types.ObjectId;
  operator: mongoose.Types.ObjectId;
  conductor?: mongoose.Types.ObjectId;
  driver?: mongoose.Types.ObjectId;
  travelDate: Date;
  departureTime: string;
  farePerSeat: number;
  recurrence: 'once' | 'daily' | 'weekly';
  recurringDays: number[];
  status: 'upcoming' | 'completed' | 'cancelled';
  cancelReason?: string;
  dynamicPricingEnabled: boolean;
  createdAt: Date;
}

const TripSchema = new Schema<ITrip>({
  bus: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
  operator: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
  conductor: { type: Schema.Types.ObjectId, ref: 'Operator' },
  driver: { type: Schema.Types.ObjectId, ref: 'Operator' },
  travelDate: { type: Date, required: true },
  departureTime: { type: String, required: true },
  farePerSeat: { type: Number, required: true },
  recurrence: { type: String, enum: ['once', 'daily', 'weekly'], default: 'once' },
  recurringDays: [{ type: Number }],
  status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' },
  cancelReason: { type: String },
  dynamicPricingEnabled: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model<ITrip>('Trip', TripSchema);
