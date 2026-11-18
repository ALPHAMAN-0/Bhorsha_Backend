import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { DriverVerification } from '../../../fleet/entities/driver-profile.entity.js';
import { trim } from './user-fields.js';

export const REVIEW_DECISIONS = [
  DriverVerification.VERIFIED,
  DriverVerification.REJECTED,
] as const;

export class VerifyDriverDto {
  @ApiProperty({ enum: REVIEW_DECISIONS, example: DriverVerification.VERIFIED })
  @IsIn(REVIEW_DECISIONS, { message: 'verification must be VERIFIED or REJECTED' })
  verification: DriverVerification.VERIFIED | DriverVerification.REJECTED;

  @ApiPropertyOptional({
    example: 'Licence photo is unreadable',
    maxLength: 1000,
    description: 'Required when verification is REJECTED',
  })
  @ValidateIf((dto: VerifyDriverDto) => dto.verification === DriverVerification.REJECTED)
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'rejectionReason is required when rejecting a driver' })
  @MaxLength(1000)
  rejectionReason?: string;
}
