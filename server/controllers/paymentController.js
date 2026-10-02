import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/env.js';
import { nextBookingStatus } from '../services/paymentState.js';

const simulateSchema = z.object({ bookingId: z.string(), result: z.enum(['SUCCESS', 'FAILED']), idempotencyKey: z.string().min(8).max(120) });
const webhookSchema = z.object({ eventId: z.string().min(1).max(200), bookingId: z.string(), status: z.enum(['SUCCESS', 'FAILED']) });

async function applyPayment({ bookingId, userId, status, eventId, idempotencyKey, source }) {
  const existingQuery = eventId ? { eventId } : { idempotencyKey };
  const prior = await Payment.findOne(existingQuery);
  if (prior) {
    if (String(prior.userId) !== String(userId) || String(prior.bookingId) !== String(bookingId) || prior.status !== status) throw new AppError(409, 'Idempotency key has already been used', 'IDEMPOTENCY_CONFLICT');
    await Booking.findOneAndUpdate({ _id: bookingId, userId, status: 'PENDING' }, { $set: { status: prior.status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED' } });
    return { payment: prior, duplicate: true };
  }

  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
  if (booking.status !== 'PENDING') throw new AppError(409, 'Booking is not awaiting payment', 'INVALID_BOOKING_STATE');
  let payment;
  try {
    [payment] = await Payment.create([{ bookingId, userId, amount: booking.amount, status, eventId, idempotencyKey, source }]);
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Payment.findOne(existingQuery);
      if (duplicate && String(duplicate.bookingId) === String(bookingId) && String(duplicate.userId) === String(userId) && duplicate.status === status) return { payment: duplicate, duplicate: true };
    }
    throw error;
  }
  const nextStatus = nextBookingStatus(booking.status, status);
  const updated = await Booking.findOneAndUpdate({ _id: bookingId, userId, status: 'PENDING' }, { $set: { status: nextStatus } }, { new: true });
  if (!updated) {
    await Payment.deleteOne({ _id: payment._id });
    throw new AppError(409, 'Booking is not awaiting payment', 'INVALID_BOOKING_STATE');
  }
  return { payment, duplicate: false };
}

export async function simulatePayment(req, res) {
  const input = simulateSchema.parse(req.body);
  if (!mongoose.isValidObjectId(input.bookingId)) throw new AppError(400, 'Invalid booking ID', 'INVALID_BOOKING_ID');
  const result = await applyPayment({ bookingId: input.bookingId, userId: req.auth.sub, status: input.result, idempotencyKey: input.idempotencyKey, source: 'simulation' });
  res.status(result.duplicate ? 200 : 201).json(result);
}

export async function getPayment(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'Invalid payment ID', 'INVALID_PAYMENT_ID');
  const payment = await Payment.findOne({ _id: req.params.id, userId: req.auth.sub });
  if (!payment) throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
  res.json({ payment });
}

export async function paymentWebhook(req, res) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  try {
    if (!token) throw new Error('Missing token');
    jwt.verify(token, config.jwtSecret, { audience: 'eve-payment-webhook' });
  } catch { throw new AppError(401, 'Webhook authentication failed', 'INVALID_WEBHOOK_AUTH'); }
  const input = webhookSchema.parse(req.body);
  if (!mongoose.isValidObjectId(input.bookingId)) throw new AppError(400, 'Invalid booking ID', 'INVALID_BOOKING_ID');
  const booking = await Booking.findById(input.bookingId);
  if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
  try {
    const result = await applyPayment({ bookingId: input.bookingId, userId: booking.userId, status: input.status, eventId: input.eventId, source: 'webhook' });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    if (error?.code === 11000) {
      const payment = await Payment.findOne({ eventId: input.eventId });
      if (payment) return res.status(200).json({ payment, duplicate: true });
    }
    throw error;
  }
}
