import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiPagination } from '../../common/dto/page.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { Role } from './entities/user.entity.js';
import { CREATE_STAFF_EXAMPLES, CreateStaffDto } from './dto/create-staff.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UPDATE_USER_EXAMPLES, UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(Role.ADMIN)
  @Get()
  @ApiPagination()
  @ApiOperation({ summary: 'List users; filter by role and status (Admin)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get one user (Admin)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create an Admin or Support Officer account (Admin)' })
  @ApiBody({ type: CreateStaffDto, examples: CREATE_STAFF_EXAMPLES })
  create(@Body() dto: CreateStaffDto) {
    return this.users.createStaff(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a profile (owner or Admin)',
    description:
      'The owner may change fullName and email. role, isActive and suspendedUntil are Admin only.',
  })
  @ApiBody({ type: UpdateUserDto, examples: UPDATE_USER_EXAMPLES })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actor, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a user; users are never deleted (Admin)' })
  remove(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.users.deactivate(actor, id);
  }
}
