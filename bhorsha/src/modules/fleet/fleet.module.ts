import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

/** Owns driver_profiles and vehicles: the driver's profile, status, location and vehicles. */
@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle])],
  controllers: [VehiclesController, DriversController],
  providers: [VehiclesService, DriversService],
  // Trips and sharing check the driver through DriversService; trips reads vehicle types through VehiclesService.
  exports: [DriversService, VehiclesService],
})
export class FleetModule {}
