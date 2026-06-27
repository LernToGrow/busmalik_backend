import mongoose, { Document, Schema } from 'mongoose';

export interface IBusStop {
  name: string;
  order: number;
  offsetMinutes: number;
  fareFromOrigin: number;
}

export interface IBus extends Document {
  busNumber: string;
  operator: mongoose.Types.ObjectId;
  from: string;
  to: string;
  departureTime: string;
  busType: 'AC Sleeper' | 'Non-AC Sleeper' | 'AC Seater' | 'Non-AC Seater' | 'AC Semi-Sleeper' | 'Non-AC Semi-Sleeper';
  totalSeats: number;
  isActive: boolean;
  stops: IBusStop[];
  deletedAt?: Date;
  createdAt: Date;
}

const BusStopSchema = new Schema<IBusStop>({
  name: { type: String, required: true },
  order: { type: Number, required: true },
  offsetMinutes: { type: Number, required: true, default: 0 },
  fareFromOrigin: { type: Number, required: true, default: 0 },
}, { _id: false });

const BusSchema = new Schema<IBus>({
  busNumber: { type: String, required: true, unique: true },
  operator: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  departureTime: { type: String, required: true },
  busType: { type: String, enum: ['AC Sleeper', 'Non-AC Sleeper', 'AC Seater', 'Non-AC Seater', 'AC Semi-Sleeper', 'Non-AC Semi-Sleeper'], required: true },
  totalSeats: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  stops: { type: [BusStopSchema], default: [] },
  deletedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model<IBus>('Bus', BusSchema);
