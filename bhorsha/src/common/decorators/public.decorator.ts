import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension, type OpenAPIObject, type OperationObject } from '@nestjs/swagger';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a @Public() operation in the Swagger document until showPublicRoutesAsPublic() reads it. */
const PUBLIC_EXTENSION = 'x-public';

/**
 * Lets a route through the global JwtAuthGuard without a token, and marks it for Swagger,
 * so the document can show it without the lock (see showPublicRoutesAsPublic).
 */
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiExtension(PUBLIC_EXTENSION, true));

/**
 * main.ts makes every operation require the bearer token (addSecurityRequirements). This lifts
 * that requirement from the @Public() operations (security: []), so Swagger UI shows no lock on them.
 */
export function showPublicRoutesAsPublic(document: OpenAPIObject): void {
  for (const path of Object.values(document.paths)) {
    const operations = [path.get, path.put, path.post, path.delete, path.patch, path.options, path.head, path.trace];
    for (const operation of operations as Array<(OperationObject & Record<string, unknown>) | undefined>) {
      if (operation?.[PUBLIC_EXTENSION]) {
        operation.security = [];
        delete operation[PUBLIC_EXTENSION];
      }
    }
  }
}
