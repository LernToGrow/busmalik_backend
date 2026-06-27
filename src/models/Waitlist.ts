import mongoose, { Document, Schema } from 'mongoose';

export interface IWaitlist extends Document {
  trip: mongoose.Types.ObjectId;
  passenger: mongoose.Types.ObjectId;
  seatsNeeded: number;
  position: number;
  status: 'waiting' | 'offered' | 'confirmed' | 'expired' | 'cancelled';
  offeredAt?: Date;
  offeredSeats: number[];
  createdAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>({
  trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  passenger: { type: Schema.Types.ObjectId, ref: 'Passenger', required: true },
  seatsNeeded: { type: Number, required: true },
  position: { type: Number, required: true },
  status: { type: String, enum: ['waiting', 'offered', 'confirmed', 'expired', 'cancelled'], default: 'waiting' },
  offeredAt: { type: Date },
  offeredSeats: [{ type: Number }],
}, { timestamps: true });

export default mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);
