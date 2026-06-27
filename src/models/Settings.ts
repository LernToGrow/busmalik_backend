import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  value: unknown;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Operator' },
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);
