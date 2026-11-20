import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { DriverVerification } from '../../fleet/entities/driver-profile.entity.js';

export class ListDriversQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DriverVerification,
    description: 'PENDING lists the oldest first, as a review queue',
  })
  @IsOptional()
  @IsEnum(DriverVerification, {
    message: 'verification must be PENDING, VERIFIED or REJECTED',
  })
  verification?: DriverVerification;
}
