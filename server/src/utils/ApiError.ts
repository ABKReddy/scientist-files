/** Operational error carrying an HTTP status code and stable machine code. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): ApiError {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED'): ApiError {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to perform this action.', code = 'FORBIDDEN'): ApiError {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found.', code = 'NOT_FOUND'): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code = 'CONFLICT'): ApiError {
    return new ApiError(409, message, code);
  }

  static payloadTooLarge(message: string, code = 'PAYLOAD_TOO_LARGE'): ApiError {
    return new ApiError(413, message, code);
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.', code = 'RATE_LIMITED'): ApiError {
    return new ApiError(429, message, code);
  }

  static internal(message = 'Something went wrong on our end.', code = 'INTERNAL_ERROR'): ApiError {
    return new ApiError(500, message, code);
  }
}