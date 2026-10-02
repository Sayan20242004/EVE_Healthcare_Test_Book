import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getPayment, paymentWebhook, simulatePayment } from '../controllers/paymentController.js';
const router = Router();
router.post('/webhook', asyncHandler(paymentWebhook));
router.post('/', requireAuth, asyncHandler(simulatePayment));
router.get('/:id', requireAuth, asyncHandler(getPayment));
export default router;
