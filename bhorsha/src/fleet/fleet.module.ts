import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle])],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class FleetModule {}