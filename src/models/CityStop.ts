import mongoose, { Document, Schema } from 'mongoose';

export interface ICityStopEntry {
  name: string;
}

export interface ICityStop extends Document {
  city: string;
  stops: ICityStopEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const CityStopEntrySchema = new Schema<ICityStopEntry>({
  name: { type: String, required: true },
}, { _id: false });

const CityStopSchema = new Schema<ICityStop>({
  city: { type: String, required: true, unique: true, trim: true },
  stops: { type: [CityStopEntrySchema], default: [] },
}, { timestamps: true });

export default mongoose.model<ICityStop>('CityStop', CityStopSchema);
