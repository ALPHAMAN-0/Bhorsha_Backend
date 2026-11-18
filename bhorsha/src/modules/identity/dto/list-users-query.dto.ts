import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Role } from '../../../users/entities/user.entity.js';

export enum UserStatusFilter {
  /** Active and not suspended right now. */
  ACTIVE = 'ACTIVE',
  /** Active, but suspended_until is in the future. */
  SUSPENDED = 'SUSPENDED',
  /** is_active = false. */
  DEACTIVATED = 'DEACTIVATED',
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'role must be RIDER, DRIVER, ADMIN or SUPPORT' })
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatusFilter })
  @IsOptional()
  @IsEnum(UserStatusFilter, {
    message: 'status must be ACTIVE, SUSPENDED or DEACTIVATED',
  })
  status?: UserStatusFilter;
}
