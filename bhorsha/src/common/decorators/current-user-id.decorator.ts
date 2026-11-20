import { CurrentUser } from './current-user.decorator.js';

/**
 * The id of the logged-in user: the same as @CurrentUser('id'). The global
 * JwtAuthGuard sets the user from the Bearer token, or from the x-user-id
 * header while ALLOW_X_USER_ID=true in development.
 */
export const CurrentUserId = (): ParameterDecorator => CurrentUser('id');
