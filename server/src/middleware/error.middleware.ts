import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

const normalize = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;

  if (error instanceof jwt.TokenExpiredError) {
    return ApiError.unauthorized('Your admin session has expired. Please log in again.', 'TOKEN_EXPIRED');
  }
  if (error instanceof jwt.JsonWebTokenError) {
    return ApiError.unauthorized('Invalid session. Please log in again.', 'INVALID_TOKEN');
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    return ApiError.badRequest(first?.message ?? 'Validation failed.', 'VALIDATION_ERROR');
  }
  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${error.path}.`, 'INVALID_ID');
  }
  if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
    const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? 'field';
    return ApiError.conflict(`That ${field} is already in use.`, 'DUPLICATE_KEY');
  }
  if (error instanceof multer.MulterError) {
    return ApiError.badRequest(`Upload failed: ${error.message}.`, 'UPLOAD_FAILED');
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('Malformed JSON payload.', 'INVALID_JSON');
  }

  return ApiError.internal();
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const apiError = normalize(error);

  if (apiError.statusCode >= 500) {
    logger.error(`[${apiError.code}] ${apiError.message}`, error);
  } else {
    logger.debug(`[${apiError.code}] ${apiError.message}`);
  }

  const body: Record<string, unknown> = {
    success: false,
    code: apiError.code,
    message: apiError.message,
  };
  if (apiError.details) body.errors = apiError.details;
  // Never leak internals in production.
  if (!env.isProduction && apiError.statusCode >= 500 && error instanceof Error) {
    body.stack = error.stack;
  }

  res.status(apiError.statusCode).json(body);
};