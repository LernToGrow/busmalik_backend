import mongoose, { Document, Schema } from 'mongoose';

export interface ISmsLog extends Document {
  bookingId?: mongoose.Types.ObjectId;
  phone: string;
  templateKey: string;
  message: string;
  status: 'sent' | 'failed';
  msgId?: string;
  createdAt: Date;
}

const SmsLogSchema = new Schema<ISmsLog>({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  phone: { type: String, required: true },
  templateKey: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], required: true },
  msgId: { type: String },
}, { timestamps: true });

export default mongoose.model<ISmsLog>('SmsLog', SmsLogSchema);
