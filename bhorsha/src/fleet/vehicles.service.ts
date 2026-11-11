import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { SEAT_CAPACITY } from './vehicle-type.js';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(DriverProfile)
    private readonly drivers: Repository<DriverProfile>,
  ) {}

  async create(userId: number, dto: CreateVehicleDto): Promise<Vehicle> {
    await this.assertIsDriver(userId);
    await this.assertRegNoFree(dto.regNo);
    const vehicle = this.vehicles.create({
      driverId: userId,
      type: dto.type,
      regNo: dto.regNo,
      seats: SEAT_CAPACITY[dto.type],
    });
    return this.vehicles.save(vehicle);
  }

  async findMine(userId: number, query: PaginationQueryDto) {
    await this.assertIsDriver(userId);
    const { page, limit } = query;
    const [data, total] = await this.vehicles.findAndCount({
      where: { driverId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  findOne(userId: number, id: number): Promise<Vehicle> {
    return this.findOwned(userId, id);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    const vehicle = await this.findOwned(userId, id);
    if (dto.regNo && dto.regNo !== vehicle.regNo) {
      await this.assertRegNoFree(dto.regNo);
    }
    const type = dto.type ?? vehicle.type;
    return this.vehicles.save({
      ...vehicle,
      ...dto,
      seats: SEAT_CAPACITY[type],
    });
  }

  async remove(userId: number, id: number): Promise<void> {
    const vehicle = await this.findOwned(userId, id);
    await this.vehicles.softDelete(vehicle.id);
  }

  private async assertIsDriver(userId: number): Promise<void> {
    const isDriver = await this.drivers.exists({ where: { userId } });
    if (!isDriver) {
      throw new ForbiddenException('Only drivers can manage vehicles');
    }
  }

  private async assertRegNoFree(regNo: string): Promise<void> {
    const taken = await this.vehicles.exists({
      where: { regNo },
      withDeleted: true,
    });
    if (taken) {
      throw new ConflictException(
        `Registration number ${regNo} is already used`,
      );
    }
  }

  private async findOwned(userId: number, id: number): Promise<Vehicle> {
    const vehicle = await this.vehicles.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    if (vehicle.driverId !== userId) {
      throw new ForbiddenException('This vehicle belongs to another driver');
    }
    return vehicle;
  }
}