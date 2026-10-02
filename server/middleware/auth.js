import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
}
