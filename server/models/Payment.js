import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  eventId: { type: String, unique: true, sparse: true },
  idempotencyKey: { type: String, unique: true, sparse: true },
  source: { type: String, enum: ['simulation', 'webhook'], required: true }
}, { timestamps: true });

paymentSchema.index({ bookingId: 1, createdAt: -1 });
export const Payment = mongoose.model('Payment', paymentSchema);
