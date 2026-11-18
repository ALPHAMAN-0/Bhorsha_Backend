import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '../../../users/entities/user.entity.js';
import { RegisterDto } from './register.dto.js';

export const STAFF_ROLES = [Role.ADMIN, Role.SUPPORT] as const;

/** POST /users: an admin creates an Admin or Support Officer account. */
export class CreateStaffDto extends PickType(RegisterDto, [
  'fullName',
  'phone',
  'email',
  'password',
] as const) {
  @ApiProperty({ enum: STAFF_ROLES, example: Role.SUPPORT })
  @IsIn(STAFF_ROLES, { message: 'role must be ADMIN or SUPPORT' })
  role: Role.ADMIN | Role.SUPPORT;
}
