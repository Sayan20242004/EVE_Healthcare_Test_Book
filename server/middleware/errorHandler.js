import mongoose from 'mongoose';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const invalidRequest = err.name === 'ZodError' || err instanceof mongoose.Error.ValidationError;
  const status = err.status || (invalidRequest ? 400 : 500);
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  if (status === 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, errorType: err.name || 'Error' }));
  const message = err.name === 'ZodError' ? err.issues?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') : err.message;
  res.status(status).json({ error: { code, message: status === 500 ? 'An unexpected error occurred' : message } });
}
