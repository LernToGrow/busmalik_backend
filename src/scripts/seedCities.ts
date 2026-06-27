import mongoose from 'mongoose';
import { env } from '../config/env';
import City from '../models/City';
import citiesData from '../data/india_cities.json';

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await City.countDocuments();
  if (existing > 0) {
    console.log(`Cities already seeded (${existing} records). Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const docs = citiesData.map((c: { id: string; name: string; state: string }) => ({
    cityId: c.id,
    name: c.name,
    state: c.state,
  }));

  await City.insertMany(docs, { ordered: false });
  console.log(`Seeded ${docs.length} cities.`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
