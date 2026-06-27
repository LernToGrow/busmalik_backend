import mongoose, { Document, Schema } from 'mongoose';

export interface ICity extends Document {
  cityId: string;
  name: string;
  state: string;
}

const CitySchema = new Schema<ICity>({
  cityId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
});

CitySchema.index({ name: 1 });

export default mongoose.model<ICity>('City', CitySchema);
