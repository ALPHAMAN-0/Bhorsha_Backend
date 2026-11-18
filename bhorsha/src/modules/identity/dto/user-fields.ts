import type { TransformFnParams } from 'class-transformer';

/** Same rule as ck_users_phone_format in the database. */
export const PHONE_PATTERN = /^\+8801[3-9]\d{8}$/;
export const PHONE_MESSAGE = 'phone must look like +8801712345678';

/** bcrypt only uses the first 72 bytes of a password. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimLower = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const trimUpper = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
