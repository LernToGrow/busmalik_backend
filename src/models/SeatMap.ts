import mongoose, { Document, Schema } from 'mongoose';

interface ISeat {
  seatNumber: number;
  status: 'available' | 'selected' | 'booked' | 'confirmed';
  bookingId: mongoose.Types.ObjectId | null;
  heldBy: mongoose.Types.ObjectId | null;
  heldAt: Date | null;
}

export interface ISeatMap extends Document {
  trip: mongoose.Types.ObjectId;
  bus: mongoose.Types.ObjectId;
  seats: ISeat[];
}

const SeatSchema = new Schema<ISeat>({
  seatNumber: { type: Number, required: true },
  status: { type: String, enum: ['available', 'selected', 'booked', 'confirmed'], default: 'available' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  heldBy: { type: Schema.Types.ObjectId, ref: 'Operator', default: null },
  heldAt: { type: Date, default: null },
}, { _id: false });

const SeatMapSchema = new Schema<ISeatMap>({
  trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
  bus: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
  seats: [SeatSchema],
}, { timestamps: true });

export default mongoose.model<ISeatMap>('SeatMap', SeatMapSchema);
