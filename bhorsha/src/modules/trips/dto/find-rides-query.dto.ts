import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { RideStatus } from '../entities/ride.entity.js';

export class FindRidesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RideStatus, description: 'Filter by ride status' })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;
}
