import Settings from '../models/Settings';
import SeatMap from '../models/SeatMap';
import { IBooking } from '../models/Booking';
import { ITrip } from '../models/Trip';

export const calculateRefund = async (booking: IBooking, trip: ITrip): Promise<number> => {
  const settingsDoc = await Settings.findOne({ key: 'cancellation_policy' });
  const policy = settingsDoc?.value as { before24h: number; between12to24h: number; within12h: number } || {
    before24h: 100, between12to24h: 50, within12h: 0,
  };

  const departure = new Date(`${trip.travelDate.toISOString().split('T')[0]}T${trip.departureTime}`);
  const now = new Date();
  const hoursUntil = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);

  let refundPercent = 0;
  if (hoursUntil >= 24) refundPercent = policy.before24h;
  else if (hoursUntil >= 12) refundPercent = policy.between12to24h;
  else refundPercent = policy.within12h;

  return Math.round((booking.finalFare * refundPercent) / 100);
};

export const calculateDynamicFare = async (tripId: string, baseFare: number): Promise<number> => {
  const settingsDoc = await Settings.findOne({ key: 'dynamic_pricing' });
  const pricing = settingsDoc?.value as {
    enabled: boolean;
    highOccupancyThreshold: number;
    highOccupancySurge: number;
    lowOccupancyThreshold: number;
    lowOccupancyDiscount: number;
    daysAheadForDiscount: number;
  } | null;

  if (!pricing || !pricing.enabled) return baseFare;

  const seatMap = await SeatMap.findOne({ trip: tripId });
  if (!seatMap) return baseFare;

  const total = seatMap.seats.length;
  const booked = seatMap.seats.filter(s => s.status === 'confirmed' || s.status === 'booked').length;
  const occupancy = total > 0 ? (booked / total) * 100 : 0;

  if (occupancy >= pricing.highOccupancyThreshold) {
    return Math.round(baseFare * (1 + pricing.highOccupancySurge / 100));
  }
  if (occupancy <= pricing.lowOccupancyThreshold) {
    return Math.round(baseFare * (1 - pricing.lowOccupancyDiscount / 100));
  }
  return baseFare;
};
