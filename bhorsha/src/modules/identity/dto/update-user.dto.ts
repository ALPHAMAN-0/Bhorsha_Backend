import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { Role } from '../../../users/entities/user.entity.js';
import { trim, trimLower } from './user-fields.js';

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
