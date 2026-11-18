import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Page } from '../../common/dto/page.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import {
  DriverAvailability,
  DriverProfile,
  DriverVerification,
} from '../../fleet/entities/driver-profile.entity.js';
import type { ListDriversQueryDto } from './dto/list-drivers-query.dto.js';
import type { VerifyDriverDto } from './dto/verify-driver.dto.js';
import { type PublicUser, toPublicUser } from './user-response.js';

/** A driver profile as the admin sees it (no live location). */
export interface DriverReview {
  userId: number;
  licenceNo: string;
  verification: DriverVerification;
  status: DriverAvailability;
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: PublicUser;
}

function toDriverReview(profile: DriverProfile): DriverReview {
  return {
    userId: profile.userId,
    licenceNo: profile.licenceNo,
    verification: profile.verification,
    status: profile.status,
    rejectionReason: profile.rejectionReason,
    reviewedBy: profile.reviewedBy,
    reviewedAt: profile.reviewedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    user: toPublicUser(profile.user),
  };
}

@Injectable()
export class DriverVerificationService {
  constructor(
    @InjectRepository(DriverProfile)
    private readonly drivers: Repository<DriverProfile>,
  ) {}

  async list(query: ListDriversQueryDto): Promise<Page<DriverReview>> {
    const { page, limit, verification } = query;
    const [rows, total] = await this.drivers.findAndCount({
      where: verification ? { verification } : {},
      relations: { user: true },
      // The pending queue is worked oldest first.
      order: {
        createdAt: verification === DriverVerification.PENDING ? 'ASC' : 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: rows.map(toDriverReview), meta: { page, limit, total } };
  }

  /**
   * Approves or rejects a driver. The update only applies if nobody else
   * reviewed the driver in the meantime. Rejecting also takes the driver
   * offline in the same statement (doc/databaseSQL.md section 9).
   */
  async verify(
    actor: AuthUser,
    id: number,
    dto: VerifyDriverDto,
  ): Promise<DriverReview> {
    const current = await this.drivers.findOneBy({ userId: id });
    if (!current) {
      throw new NotFoundException('Driver not found');
    }
    if (current.verification === dto.verification) {
      throw new ConflictException(`Driver is already ${dto.verification}`);
    }
    const rejecting = dto.verification === DriverVerification.REJECTED;
    const result = await this.drivers
      .createQueryBuilder()
      .update(DriverProfile)
      .set({
        verification: dto.verification,
        rejectionReason: rejecting ? dto.rejectionReason : null,
        reviewedBy: actor.id,
        reviewedAt: () => 'now()',
        ...(rejecting ? { status: DriverAvailability.OFFLINE } : {}),
      })
      .where('user_id = :id AND verification = :current', {
        id,
        current: current.verification,
      })
      .execute();
    if (!result.affected) {
      throw new ConflictException(
        'This driver was just reviewed by someone else; reload and try again',
      );
    }
    return this.findOne(id);
  }

  private async findOne(id: number): Promise<DriverReview> {
    const profile = await this.drivers.findOne({
      where: { userId: id },
      relations: { user: true },
    });
    if (!profile) {
      throw new NotFoundException('Driver not found');
    }
    return toDriverReview(profile);
  }
}
