import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Page } from '../../common/dto/page.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import {
  DriverAvailability,
  DriverProfile,
} from '../../fleet/entities/driver-profile.entity.js';
import { Role, User } from '../../users/entities/user.entity.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import {
  type ListUsersQueryDto,
  UserStatusFilter,
} from './dto/list-users-query.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { PasswordService } from './password.service.js';
import { type PublicUser, toPublicUser } from './user-response.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Page<PublicUser>> {
    const { page, limit, role, status } = query;
    const builder = this.users
      .createQueryBuilder('u')
      .orderBy('u.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (role) {
      builder.andWhere('u.role = :role', { role });
    }
    if (status === UserStatusFilter.ACTIVE) {
      builder
        .andWhere('u.isActive = true')
        .andWhere('(u.suspendedUntil IS NULL OR u.suspendedUntil <= now())');
    } else if (status === UserStatusFilter.SUSPENDED) {
      builder.andWhere('u.isActive = true').andWhere('u.suspendedUntil > now()');
    } else if (status === UserStatusFilter.DEACTIVATED) {
      builder.andWhere('u.isActive = false');
    }
    const [rows, total] = await builder.getManyAndCount();
    return { data: rows.map(toPublicUser), meta: { page, limit, total } };
  }

  async findOne(id: number): Promise<PublicUser> {
    const user = await this.users.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }

  /** A taken phone or email becomes 409 in the exception filter. */
  async createStaff(dto: CreateStaffDto): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(dto.password);
    const inserted = await this.users.insert({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email ?? null,
      passwordHash,
      role: dto.role,
    });
    const [identifier] = inserted.identifiers as Array<{ id: number }>;
    return this.findOne(Number(identifier.id));
  }

  async update(
    actor: AuthUser,
    id: number,
    dto: UpdateUserDto,
  ): Promise<PublicUser> {
    const isAdmin = actor.role === Role.ADMIN;
    // Checked before any lookup, so nobody can probe which ids exist.
    if (!isAdmin && actor.id !== id) {
      throw new ForbiddenException('You can only change your own profile');
    }
    const changesStatus =
      dto.role !== undefined ||
      dto.isActive !== undefined ||
      dto.suspendedUntil !== undefined;
    if (changesStatus && !isAdmin) {
      throw new ForbiddenException('Only an admin can change role or status');
    }
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Send at least one field to change');
    }

    const user = await this.users.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const changesRole = dto.role !== undefined && dto.role !== user.role;
    if (
      actor.id === id &&
      (changesRole || dto.isActive === false || dto.suspendedUntil)
    ) {
      // Keeps the last admin from locking everyone out.
      throw new ForbiddenException(
        'You cannot change your own role, deactivate or suspend yourself',
      );
    }
    if (changesRole && (dto.role === Role.DRIVER || user.role === Role.DRIVER)) {
      throw new ConflictException(
        'Driver accounts come from driver registration and cannot change role',
      );
    }

    const patch: Partial<User> = {};
    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.suspendedUntil !== undefined) patch.suspendedUntil = dto.suspendedUntil;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, { id }, patch);
      if (dto.isActive === false) {
        await manager.update(
          DriverProfile,
          { userId: id },
          { status: DriverAvailability.OFFLINE },
        );
      }
    });
    return this.findOne(id);
  }

  /**
   * DELETE /users/:id. Users are never deleted (every foreign key is
   * RESTRICT): the account is deactivated and a driver is taken offline.
   */
  async deactivate(actor: AuthUser, id: number): Promise<void> {
    if (actor.id === id) {
      throw new ForbiddenException('You cannot deactivate yourself');
    }
    if (!(await this.users.existsBy({ id }))) {
      throw new NotFoundException('User not found');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, { id }, { isActive: false });
      await manager.update(
        DriverProfile,
        { userId: id },
        { status: DriverAvailability.OFFLINE },
      );
    });
  }
}
