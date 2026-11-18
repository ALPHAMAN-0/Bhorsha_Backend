import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * PATCH /fare-rules/:id. Only the tariff is editable. The legal ceiling,
 * base distance and vehicle type are frozen (they change only by migration),
 * so the global ValidationPipe refuses them as unknown fields with 400.
 */
export class UpdateFareRuleDto {
  @ApiPropertyOptional({
    example: 8000,
    description: 'Fare for the first base distance, in paisa (Tk 80 = 8000)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  basePaisa?: number;

  @ApiPropertyOptional({
    example: 3000,
    description: 'Fare per km after the base distance, in paisa',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  perKmPaisa?: number;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Shared-ride discount in basis points (2500 = 25%), 1 to 9999',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  shareDiscountBps?: number;
}
