import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DriverProfile } from '../../fleet/entities/driver-profile.entity.js';
import { Role, User } from '../../users/entities/user.entity.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';
import {
  type PublicDriverProfile,
  type PublicUser,
  toPublicDriverProfile,
  toPublicUser,
} from './user-response.js';

/** What the access token carries. The guard re-reads the user anyway. */
export interface JwtPayload {
  sub: number;
  role: Role;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
}

export type RegisteredUser = PublicUser & {
  driverProfile: PublicDriverProfile | null;
};

const INVALID_LOGIN = 'Invalid phone or password';

@Injectable()
export class AuthService {
  private readonly expiresIn: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DriverProfile)
    private readonly drivers: Repository<DriverProfile>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    config: ConfigService,
  ) {
    this.expiresIn = config.get<string>('JWT_ACCESS_TTL', '15m');
  }

  /**
   * Creates a rider or a driver. For a driver the user and the driver profile
   * are inserted in one transaction, so a taken licence number leaves no user
   * behind. Taken phone, email or licence numbers become 409 in the filter.
   */
  async register(dto: RegisterDto): Promise<RegisteredUser> {
    const isDriver = dto.role === Role.DRIVER;
    if (!isDriver && dto.licenceNo !== undefined) {
      throw new BadRequestException('Only drivers have a licence number');
    }
    if (isDriver && !dto.licenceNo) {
      throw new BadRequestException('licenceNo is required for drivers');
    }
    // Hash before the transaction: bcrypt is slow and shouldn't hold a connection.
    const passwordHash = await this.passwords.hash(dto.password);
    const userId = await this.insertAccount(dto, passwordHash);
    return this.findRegistered(userId);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.phone = :phone', { phone: dto.phone })
      .getOne();
    if (!user) {
      await this.passwords.compareWithDummy(dto.password);
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    if (!(await this.passwords.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    // Only checked after the password matched, so it can't be used to probe phones.
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user: toPublicUser(user),
    };
  }

  private async insertAccount(
    dto: RegisterDto,
    passwordHash: string,
  ): Promise<number> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const inserted = await runner.manager.insert(User, {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? null,
        passwordHash,
        role: dto.role,
      });
      const [identifier] = inserted.identifiers as Array<{ id: number }>;
      const userId = Number(identifier.id);
      if (dto.role === Role.DRIVER && dto.licenceNo) {
        await runner.manager.insert(DriverProfile, {
          userId,
          licenceNo: dto.licenceNo,
        });
      }
      await runner.commitTransaction();
      return userId;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async findRegistered(id: number): Promise<RegisteredUser> {
    const user = await this.users.findOneByOrFail({ id });
    const profile =
      user.role === Role.DRIVER
        ? await this.drivers.findOneBy({ userId: id })
        : null;
    return {
      ...toPublicUser(user),
      driverProfile: profile ? toPublicDriverProfile(profile) : null,
    };
  }
}
