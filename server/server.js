import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { config } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import centreRoutes from './routes/centreRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => { req.id = randomUUID(); res.setHeader('X-Request-Id', req.id); next(); });
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 }), authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, async () => {
    console.log(`EVE API listening on port ${config.port}`);
    if (config.mongoUri) {
      try { await mongoose.connect(config.mongoUri); console.log('MongoDB connected'); }
      catch (error) { console.error(JSON.stringify({ level: 'error', message: 'MongoDB connection failed', errorType: error.name || 'Error' })); server.close(() => process.exit(1)); }
    } else console.warn('MONGODB_URI is empty; database-backed routes require configuration.');
  });
}
