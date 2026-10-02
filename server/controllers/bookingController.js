import mongoose from 'mongoose';
import { z } from 'zod';
import { Booking } from '../models/Booking.js';
import { Centre } from '../models/Centre.js';
import { AppError } from '../utils/AppError.js';
import { calculateAmount, validateAppointment } from '../services/bookingService.js';

const idSchema = z.string().refine((value) => mongoose.isValidObjectId(value), 'Invalid booking ID');
const createSchema = z.object({ centreId: z.string(), testId: z.string().min(1), appointmentDate: z.string(), appointmentTime: z.string(), persons: z.number().int() });

export async function createBooking(req, res) {
  const input = createSchema.parse(req.body);
  if (!mongoose.isValidObjectId(input.centreId)) throw new AppError(400, 'Invalid centre ID', 'INVALID_CENTRE_ID');
  const centre = await Centre.findById(input.centreId);
  if (!centre) throw new AppError(404, 'Centre not found', 'CENTRE_NOT_FOUND');
  const test = centre.tests.find((item) => item.testId === input.testId);
  if (!test) throw new AppError(400, 'This test is not offered at the selected centre', 'TEST_UNAVAILABLE');
  const appointmentDate = validateAppointment({ date: input.appointmentDate, time: input.appointmentTime, persons: input.persons, centre });
  const booking = await Booking.create({ userId: req.auth.sub, centreId: centre._id, testId: test.testId, testName: test.name, centreName: centre.name, appointmentDate, appointmentTime: input.appointmentTime, persons: input.persons, unitPrice: test.price, amount: calculateAmount(test.price, input.persons) });
  res.status(201).json({ booking });
}

export async function myBookings(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20));
  const [bookings, total] = await Promise.all([
    Booking.find({ userId: req.auth.sub }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Booking.countDocuments({ userId: req.auth.sub })
  ]);
  res.json({ bookings, page, limit, total });
}

export async function getBooking(req, res) {
  const id = idSchema.parse(req.params.id);
  const booking = await Booking.findOne({ _id: id, userId: req.auth.sub });
  if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
  res.json({ booking });
}

export async function cancelBooking(req, res) {
  const id = idSchema.parse(req.params.id);
  const booking = await Booking.findOne({ _id: id, userId: req.auth.sub });
  if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
  if (booking.status !== 'PENDING') throw new AppError(409, 'Only pending bookings can be cancelled', 'INVALID_BOOKING_STATE');
  booking.status = 'CANCELLED'; await booking.save();
  res.json({ booking });
}
