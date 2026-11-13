import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverRidesController } from './driver-rides.controller.js';
import { DriverRidesService } from './driver-rides.service.js';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle])],
  controllers: [VehiclesController, DriversController, DriverRidesController],
  providers: [VehiclesService, DriversService, DriverRidesService],
})
export class FleetModule {}