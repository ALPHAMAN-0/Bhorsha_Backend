import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MAX, PHONE_MESSAGE, PHONE_PATTERN } from './user-fields.js';

export class LoginDto {
  @ApiProperty({ example: '+8801712345678' })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX)
  password: string;
}
