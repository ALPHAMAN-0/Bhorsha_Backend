import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Lets a route through the global JwtAuthGuard without a token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
