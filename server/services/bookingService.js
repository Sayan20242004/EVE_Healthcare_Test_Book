import { AppError } from '../utils/AppError.js';

export function isValidTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

export function validateAppointment({ date, time, persons, centre }) {
  const appointmentDate = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(appointmentDate.getTime()) && appointmentDate.toISOString().slice(0, 10) === date;
  if (!parsedDate || appointmentDate < today) throw new AppError(400, 'Appointment date must be a valid date today or later', 'INVALID_APPOINTMENT_DATE');
  if (!isValidTime(time)) throw new AppError(400, 'Appointment time must use HH:mm format', 'INVALID_APPOINTMENT_TIME');
  if (time < centre.openingTime || time >= centre.closingTime) throw new AppError(400, `Appointment must be between ${centre.openingTime} and ${centre.closingTime}`, 'OUTSIDE_OPENING_HOURS');
  if (!Number.isInteger(persons) || persons < 1 || persons > 10) throw new AppError(400, 'Persons must be an integer from 1 to 10', 'INVALID_PERSONS');
  return appointmentDate;
}

export function calculateAmount(price, persons) {
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(persons) || persons < 1) throw new AppError(400, 'Invalid price or persons', 'INVALID_AMOUNT');
  return Math.round(price * persons * 100) / 100;
}
