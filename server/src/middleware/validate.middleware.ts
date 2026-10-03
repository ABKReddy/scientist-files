import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

const formatIssues = (error: ZodError): { field: string; message: string }[] =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '_',
    message: issue.message,
  }));

/** Validates and replaces the given request property with the parsed (coerced, stripped) value. */
export const validate = (
  schema: ZodTypeAny,
  source: Source = 'body'
): RequestHandler => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const issues = formatIssues(result.error);
    const first = issues[0];
    return next(
      ApiError.badRequest(
        first ? `${first.field === '_' ? '' : `${first.field}: `}${first.message}` : 'Invalid request.',
        'VALIDATION_ERROR',
        issues
      )
    );
  }
  // req.query / req.params are getter-only on Express 5; assign defensively.
  try {
    (req as unknown as Record<Source, unknown>)[source] = result.data;
  } catch {
    // Non-writable property (Express 5): validation still succeeds, parsing just isn't applied.
  }
  return next();
};