import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiPagination } from '../../common/dto/page.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { Role } from '../../users/entities/user.entity.js';
import { DriverVerificationService } from './driver-verification.service.js';
import { ListDriversQueryDto } from './dto/list-drivers-query.dto.js';
import { VerifyDriverDto } from './dto/verify-driver.dto.js';

/**
 * Admin side of /drivers. The driver's own routes (/drivers/me...) live in
 * the fleet module.
 */
@ApiTags('Drivers (Admin)')
@Controller('drivers')
export class DriverVerificationController {
  constructor(private readonly verification: DriverVerificationService) {}

  @Roles(Role.ADMIN)
  @Get()
  @ApiPagination()
  @ApiOperation({ summary: 'List drivers; filter by verification (Admin)' })
  list(@Query() query: ListDriversQueryDto) {
    return this.verification.list(query);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/verify')
  @ApiOperation({
    summary: 'Approve or reject a driver (Admin)',
    description:
      'Rejecting needs a rejectionReason and also takes the driver offline.',
  })
  verify(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyDriverDto,
  ) {
    return this.verification.verify(actor, id, dto);
  }
}
