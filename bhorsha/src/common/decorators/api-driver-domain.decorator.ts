import { applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

/**
 * Swagger for the driver's controllers (in fleet, trips and sharing): the
 * "Driver Domain" group and the development-only x-user-id header.
 */
export const ApiDriverDomain = () =>
  applyDecorators(
    ApiTags('Driver Domain'),
    ApiHeader({
      name: 'x-user-id',
      description: 'Who is calling (user ID). Leave empty to see 401',
      required: false,
      example: '5',
    }),
  );
