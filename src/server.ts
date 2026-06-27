import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';
import Settings from './models/Settings';
import Waitlist from './models/Waitlist';
import SeatMap from './models/SeatMap';

const seedDefaultSettings = async () => {
  const defaults = [
    { key: 'cancellation_policy', value: { before24h: 100, between12to24h: 50, within12h: 0 } },
    { key: 'dynamic_pricing', value: { enabled: false, highOccupancyThreshold: 80, highOccupancySurge: 10, lowOccupancyThreshold: 40, lowOccupancyDiscount: 10, daysAheadForDiscount: 3 } },
    { key: 'company', value: { name: 'BusMalik', phone: '', email: '', address: '' } },
  ];
  for (const d of defaults) {
    await Settings.findOneAndUpdate({ key: d.key }, { $setOnInsert: d }, { upsert: true });
  }
};

const checkExpiredOffers = async () => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const expired = await Waitlist.find({ status: 'offered', offeredAt: { $lt: cutoff } });
  for (const entry of expired) {
    entry.status = 'expired';
    await entry.save();
    const seatMap = await SeatMap.findOne({ trip: entry.trip });
    if (seatMap) {
      seatMap.seats.forEach(s => {
        if (entry.offeredSeats.includes(s.seatNumber)) { s.status = 'available'; s.heldBy = null; s.heldAt = null; }
      });
      await seatMap.save();
    }
  }
};

const start = async () => {
  await connectDB();
  await seedDefaultSettings();
  setInterval(checkExpiredOffers, 5 * 60 * 1000);
  app.listen(env.PORT, () => {
    console.log(`BusMalik API running on http://localhost:${env.PORT}`);
  });
};

start().catch(console.error);
