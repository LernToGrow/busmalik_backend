import mongoose, { Document, Schema } from 'mongoose';

export interface IPassenger extends Document {
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  idProofType?: 'Aadhaar' | 'PAN' | 'Passport' | 'VoterID';
  idProofNumber?: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PassengerSchema = new Schema<IPassenger>({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  age: { type: Number, min: 1, max: 120 },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  idProofType: { type: String, enum: ['Aadhaar', 'PAN', 'Passport', 'VoterID'] },
  idProofNumber: { type: String },
  isBlacklisted: { type: Boolean, default: false },
  blacklistReason: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
}, { timestamps: true });

export default mongoose.model<IPassenger>('Passenger', PassengerSchema);
