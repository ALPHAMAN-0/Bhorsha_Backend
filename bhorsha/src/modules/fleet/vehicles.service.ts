import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { SEAT_CAPACITY, type VehicleType } from './vehicle-type.js';

const ACTIVE_RIDE_STATUSES = [
  'ACCEPTED',
  'ARRIVED',
  'IN_PROGRESS',
  'AWAITING_HANDOVER',
];

const ACTIVE_RIDE_FOR_VEHICLE_SQL = `
SELECT id
  FROM rides
 WHERE vehicle_id = $1 AND status = ANY ($2::ride_status[])
 LIMIT 1`;

const LIVE_OFFER_FOR_VEHICLE_SQL = `
SELECT id
  FROM route_offers
 WHERE vehicle_id = $1 AND status = 'OPEN' AND expires_at > now()
 LIMIT 1`;

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

  /** The types of the driver's vehicles (removed ones excluded): the open requests they can take. */
  async typesOf(driverId: number): Promise<VehicleType[]> {
    const vehicles = await this.vehicles.find({ where: { driverId } });
    return [...new Set(vehicles.map((vehicle) => vehicle.type))];
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
    return this.vehicles.save({ ...vehicle, ...dto });
  }

  async remove(userId: number, id: number): Promise<void> {
    await this.vehicles.manager.transaction(async (manager) => {
      const vehicle = await this.findOwned(userId, id, manager, true);
      await this.assertNotInUse(manager, vehicle.id);
      await manager.softDelete(Vehicle, vehicle.id);
    });
  }

  private async assertNotInUse(
    manager: EntityManager,
    vehicleId: number,
  ): Promise<void> {
    const rides: { id: number }[] = await manager.query(
      ACTIVE_RIDE_FOR_VEHICLE_SQL,
      [vehicleId, ACTIVE_RIDE_STATUSES],
    );
    if (rides.length > 0) {
      throw new ConflictException(
        `This vehicle is on active ride ${rides[0].id}`,
      );
    }
    const offers: { id: number }[] = await manager.query(
      LIVE_OFFER_FOR_VEHICLE_SQL,
      [vehicleId],
    );
    if (offers.length > 0) {
      throw new ConflictException(
        `This vehicle has an open route offer (id ${offers[0].id})`,
      );
    }
  }

  private async assertIsDriver(userId: number): Promise<void> {
    const isDriver = await this.drivers.exists({ where: { userId } });
    if (!isDriver) {
      throw new ForbiddenException('Only drivers can manage vehicles');
    }
  }

  private async assertRegNoFree(regNo: string): Promise<void> {
    const taken = await this.vehicles.exists({ where: { regNo } });
    if (taken) {
      throw new ConflictException(
        `Registration number ${regNo} is already used`,
      );
    }
  }

  private async findOwned(
    userId: number,
    id: number,
    manager: EntityManager = this.vehicles.manager,
    forUpdate = false,
  ): Promise<Vehicle> {
    const vehicle = await manager.findOne(Vehicle, {
      where: { id },
      lock: forUpdate ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    if (vehicle.driverId !== userId) {
      throw new ForbiddenException('This vehicle belongs to another driver');
    }
    return vehicle;
  }
}