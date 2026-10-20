import { BadRequestException } from '@nestjs/common';
import { ValidationError } from './validation';

/** Run a parser and turn ValidationError into HTTP 400. */
export function validate<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ValidationError) throw new BadRequestException(err.message);
    throw err;
  }
}
