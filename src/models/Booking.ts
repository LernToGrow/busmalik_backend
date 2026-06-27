import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  bookingId: string;
  trip: mongoose.Types.ObjectId;
  bus: mongoose.Types.ObjectId;
  passenger: mongoose.Types.ObjectId;
  operator: mongoose.Types.ObjectId;
  seats: number[];
  totalFare: number;
  discountAmount: number;
  finalFare: number;
  paymentMethod: 'cash' | 'upi' | 'partial' | 'pending';
  amountPaid: number;
  balanceDue: number;
  upiRef?: string;
  paymentStatus: 'paid' | 'partial' | 'pending';
  status: 'booked' | 'confirmed' | 'cancelled' | 'boarded';
  cancelReason?: string;
  refundAmount?: number;
  boardedAt?: Date;
  couponCode?: string;
  fromStop?: string;
  toStop?: string;
  createdAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  bookingId: { type: String, required: true, unique: true },
  trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  bus: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
  passenger: { type: Schema.Types.ObjectId, ref: 'Passenger', required: true },
  operator: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
  seats: [{ type: Number }],
  totalFare: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  finalFare: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'partial', 'pending'], required: true },
  amountPaid: { type: Number, required: true },
  balanceDue: { type: Number, default: 0 },
  upiRef: { type: String },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'pending'], default: 'pending' },
  status: { type: String, enum: ['booked', 'confirmed', 'cancelled', 'boarded'], default: 'booked' },
  cancelReason: { type: String },
  refundAmount: { type: Number },
  boardedAt: { type: Date },
  couponCode: { type: String },
  fromStop: { type: String },
  toStop: { type: String },
}, { timestamps: true });

BookingSchema.index({ trip: 1 });
BookingSchema.index({ passenger: 1 });
BookingSchema.index({ operator: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ createdAt: -1 });

export default mongoose.model<IBooking>('Booking', BookingSchema);
