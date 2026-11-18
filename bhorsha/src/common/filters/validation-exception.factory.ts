import { BadRequestException, type ValidationError } from '@nestjs/common';

export interface FieldError {
  field: string;
  messages: string[];
}

/** Flattens class-validator errors into one entry per field (nested as a.b). */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** exceptionFactory for the global ValidationPipe: a 400 that names each field. */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    details: flattenValidationErrors(errors),
  });
}
