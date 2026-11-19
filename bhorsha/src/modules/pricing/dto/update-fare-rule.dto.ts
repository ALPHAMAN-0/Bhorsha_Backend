import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { MAX_TK } from '../../../common/money.js';

/**
 * PATCH /fare-rules/:id. Only the tariff is editable. The legal ceiling,
 * base distance and vehicle type are frozen (they change only by migration),
 * so the global ValidationPipe refuses them as unknown fields with 400.
 * Amounts are in Tk (up to 2 decimals); the service stores them as paisa.
 */
export class UpdateFareRuleDto {
  @ApiPropertyOptional({
    example: 80,
    description: 'Fare for the first base distance, in Tk (up to 2 decimals, e.g. 80 or 80.50)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_TK)
  baseTk?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Fare per km after the base distance, in Tk (up to 2 decimals)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_TK)
  perKmTk?: number;

  @ApiPropertyOptional({
    example: 25,
    description: 'Shared-ride discount in percent (25 = 25% off), 0.01 to 99.99',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  shareDiscountPercent?: number;
}
