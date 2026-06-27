import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { sendError } from './utils/response';

import authRoutes from './routes/auth';
import busRoutes from './routes/buses';
import tripRoutes from './routes/trips';
import passengerRoutes from './routes/passengers';
import bookingRoutes from './routes/bookings';
import couponRoutes from './routes/coupons';
import waitlistRoutes from './routes/waitlist';
import reportRoutes from './routes/reports';
import smsRoutes from './routes/sms';
import operatorRoutes from './routes/operators';
import payoutRoutes from './routes/payouts';
import settlementRoutes from './routes/settlements';
import settingsRoutes from './routes/settings';
import cityStopRoutes from './routes/cityStops';
import cityRoutes from './routes/cities';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/trips', bookingRoutes);   // seatmap routes: /api/trips/:tripId/seatmap
app.use('/api/coupons', couponRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/city-stops', cityStopRoutes);
app.use('/api/cities', cityRoutes);

// Global error handler
app.use((err: Error & { name?: string; code?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  if (err.name === 'CastError') return sendError(res, 'Invalid ID format', 400);
  if (err.name === 'ValidationError') return sendError(res, err.message, 400);
  if (err.code === 11000) return sendError(res, 'Duplicate entry', 400);
  sendError(res, err.message || 'Internal server error', 500);
});

export default app;
