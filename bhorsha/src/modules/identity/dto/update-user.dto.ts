import { ApiPropertyOptional, type ExamplesObject } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../entities/user.entity.js';
import { trim, trimLower } from './user-fields.js';

/**
 * Swagger examples for PATCH /users/:id, one change each. Without them Swagger UI fills in every
 * field (role RIDER, isActive, suspendedUntil): the owner gets 403, and an admin who presses
 * Execute renames, suspends and re-roles the user at once.
 */
export const UPDATE_USER_EXAMPLES: ExamplesObject = {
  rename: { summary: 'Change your name (owner)', value: { fullName: 'Rahim Uddin' } },
  email: { summary: 'Change your email; null removes it (owner)', value: { email: 'rahim.uddin@example.com' } },
  suspend: { summary: 'Suspend until a date (Admin)', value: { suspendedUntil: '2027-01-01T00:00:00Z' } },
  unsuspend: { summary: 'Lift a suspension (Admin)', value: { suspendedUntil: null } },
  deactivate: { summary: 'Deactivate the account (Admin)', value: { isActive: false } },
  role: { summary: 'Change the role, never to or from DRIVER (Admin)', value: { role: Role.SUPPORT } },
};

/**
 * PATCH /users/:id. The owner may change fullName and email; role, isActive
 * and suspendedUntil are admin only (checked in UsersService).
 * ValidateIf instead of IsOptional where null must be refused.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Rahim Uddin', maxLength: 100 })
  @ValidateIf((dto: UpdateUserDto) => dto.fullName !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'rahim@example.com',
    nullable: true,
    description: 'null removes the email',
  })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ enum: Role, description: 'Admin only' })
  @ValidateIf((dto: UpdateUserDto) => dto.role !== undefined)
  @IsEnum(Role, { message: 'role must be RIDER, DRIVER, ADMIN or SUPPORT' })
  role?: Role;

  @ApiPropertyOptional({ description: 'Admin only. false deactivates the account' })
  @ValidateIf((dto: UpdateUserDto) => dto.isActive !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-26T00:00:00Z',
    description: 'Admin only. null lifts a suspension',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  suspendedUntil?: Date | null;
}
