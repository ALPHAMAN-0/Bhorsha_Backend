import { ApiProperty, ApiPropertyOptional, type ExamplesObject } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../entities/user.entity.js';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  PHONE_MESSAGE,
  PHONE_PATTERN,
  trim,
  trimLower,
  trimUpper,
} from './user-fields.js';

export const SELF_SIGNUP_ROLES = [Role.RIDER, Role.DRIVER] as const;

/**
 * Swagger examples for POST /auth/register. Without them Swagger UI fills in every field,
 * licenceNo included, and a RIDER with a licence number is refused. The rider's phone and
 * password match the POST /auth/login example.
 */
export const REGISTER_EXAMPLES: ExamplesObject = {
  rider: {
    summary: 'A rider',
    value: {
      fullName: 'Rahim Uddin',
      phone: '+8801712345678',
      email: 'rahim@example.com',
      password: 'Str0ngPass!',
      role: Role.RIDER,
    },
  },
  driver: {
    summary: 'A driver (licenceNo is required)',
    value: {
      fullName: 'Sohel Rana',
      phone: '+8801912345678',
      email: 'sohel@example.com',
      password: 'Str0ngPass!',
      role: Role.DRIVER,
      licenceNo: 'DK-0123456789',
    },
  },
};

export class RegisterDto {
  @ApiProperty({ example: 'Rahim Uddin', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '+8801712345678' })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string;

  @ApiPropertyOptional({ example: 'rahim@example.com' })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: 'Str0ngPass!', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password: string;

  @ApiProperty({ enum: SELF_SIGNUP_ROLES, example: Role.RIDER })
  @IsIn(SELF_SIGNUP_ROLES, { message: 'role must be RIDER or DRIVER' })
  role: Role.RIDER | Role.DRIVER;

  @ApiPropertyOptional({
    example: 'DK-0123456789',
    maxLength: 30,
    description: 'Driving licence number. Required when role is DRIVER.',
  })
  @ValidateIf((dto: RegisterDto) => dto.role === Role.DRIVER || dto.licenceNo !== undefined)
  @Transform(trimUpper)
  @IsString()
  @IsNotEmpty({ message: 'licenceNo is required for drivers' })
  @MaxLength(30)
  licenceNo?: string;
}
