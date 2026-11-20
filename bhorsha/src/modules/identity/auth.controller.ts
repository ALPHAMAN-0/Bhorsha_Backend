import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { REGISTER_EXAMPLES, RegisterDto } from './dto/register.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a rider or a driver',
    description:
      'A driver also needs licenceNo; the user and the driver profile are created in one transaction. A taken phone, email or licence number returns 409.',
  })
  @ApiBody({ type: RegisterDto, examples: REGISTER_EXAMPLES })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with phone and password',
    description:
      'Returns a JWT access token. Use it in Swagger with the Authorize button.',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
