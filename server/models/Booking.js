import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  testId: { type: String, required: true },
  testName: { type: String, required: true },
  centreName: { type: String, required: true },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },
  persons: { type: Number, required: true, min: 1, max: 10 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'], default: 'PENDING', index: true }
}, { timestamps: true });

bookingSchema.index({ userId: 1, createdAt: -1 });
export const Booking = mongoose.model('Booking', bookingSchema);
