import { ApiProperty, type ExamplesObject, PickType } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '../entities/user.entity.js';
import { RegisterDto } from './register.dto.js';

export const STAFF_ROLES = [Role.ADMIN, Role.SUPPORT] as const;

/** Swagger examples for POST /users, with phones of their own (not the register example's). */
export const CREATE_STAFF_EXAMPLES: ExamplesObject = {
  support: {
    summary: 'A Support Officer',
    value: {
      fullName: 'Nasrin Sultana',
      phone: '+8801812345678',
      email: 'nasrin@example.com',
      password: 'Str0ngPass!',
      role: Role.SUPPORT,
    },
  },
  admin: {
    summary: 'Another Admin',
    value: {
      fullName: 'Arif Hasan',
      phone: '+8801612345678',
      email: 'arif@example.com',
      password: 'Str0ngPass!',
      role: Role.ADMIN,
    },
  },
};

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
