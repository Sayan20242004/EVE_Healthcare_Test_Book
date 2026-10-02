import { AppError } from '../utils/AppError.js';

export function nextBookingStatus(currentStatus, paymentStatus) {
  if (currentStatus !== 'PENDING') throw new AppError(409, 'Booking is not awaiting payment', 'INVALID_BOOKING_STATE');
  if (!['SUCCESS', 'FAILED'].includes(paymentStatus)) throw new AppError(400, 'Payment result must be SUCCESS or FAILED', 'INVALID_PAYMENT_STATUS');
  return paymentStatus === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
}
