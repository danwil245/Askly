import { ZodError } from 'zod';
import { AppError, ERROR_CODES } from '../utils/errors.js';
import { firstZodMessage } from '../utils/ack.js';

/**
 * Express middleware factory: validate `req[source]` against a zod schema and
 * replace it with the parsed (coerced) value. Validation failures become a 400
 * VALIDATION_ERROR via the central error handler.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new AppError(ERROR_CODES.VALIDATION_ERROR, firstZodMessage(err)));
        return;
      }
      next(err);
    }
  };
}
