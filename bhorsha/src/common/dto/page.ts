import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

/** A page of a list. TransformInterceptor turns it into { data, meta }. */
export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

/** Documents the page and limit query parameters of PaginationQueryDto. */
export const ApiPagination = () =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 10,
      description: '1 to 50',
    }),
  );

/** The limit query parameter of the cursor-paged support lists (cases, strikes, audit logs), for @ApiQuery(). */
export const LIMIT_QUERY = {
  name: 'limit',
  required: false,
  type: Number,
  description: '1 to 100 (default 20)',
  example: 20,
};
