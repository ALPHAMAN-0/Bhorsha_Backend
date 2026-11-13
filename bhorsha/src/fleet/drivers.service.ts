import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import {
  DriverAvailability,
  DriverProfile,
  DriverVerification,
} from './entities/driver-profile.entity.js';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(DriverProfile)
    private readonly drivers: Repository<DriverProfile>,
  ) {}

  async findMe(userId: number): Promise<DriverProfile> {
    const profile = await this.drivers.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!profile) {
      throw new ForbiddenException('Only drivers have a driver profile');
    }
    return profile;
  }

  async updateStatus(
    userId: number,
    dto: UpdateStatusDto,
  ): Promise<DriverProfile> {
    const profile = await this.findMe(userId);
    const goingOnline = dto.status === DriverAvailability.ONLINE;
    if (goingOnline && profile.verification !== DriverVerification.VERIFIED) {
      throw new ForbiddenException('Only a verified driver can go online');
    }
    await this.drivers.update({ userId }, { status: dto.status });
    return { ...profile, status: dto.status };
  }

  async updateLocation(
    userId: number,
    dto: UpdateLocationDto,
  ): Promise<DriverProfile> {
    const profile = await this.findMe(userId);
    const location = {
      lastLat: dto.lat,
      lastLng: dto.lng,
      lastLocationAt: new Date(),
    };
    await this.drivers.update({ userId }, location);
    return { ...profile, ...location };
  }
}