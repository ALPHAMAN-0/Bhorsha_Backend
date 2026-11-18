import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ApiPagination } from '../../common/dto/page.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { Role } from '../../users/entities/user.entity.js';
import { UpdateFareRuleDto } from './dto/update-fare-rule.dto.js';
import { FareRulesService } from './fare-rules.service.js';

@ApiTags('Fare rules')
@Roles(Role.ADMIN)
@Controller('fare-rules')
export class FareRulesController {
  constructor(private readonly fareRules: FareRulesService) {}

  @Get()
  @ApiPagination()
  @ApiOperation({ summary: 'The fare rule for each vehicle type (Admin)' })
  list(@Query() query: PaginationQueryDto) {
    return this.fareRules.list(query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change a fare rule (Admin)',
    description:
      'Only basePaisa, perKmPaisa and shareDiscountBps can change. Rates above the legal ceiling return 409.',
  })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFareRuleDto,
  ) {
    return this.fareRules.update(actor, id, dto);
  }
}
