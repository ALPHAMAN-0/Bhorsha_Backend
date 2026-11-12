import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  controllers: [DriversController, VehiclesController],
  providers: [DriversService, VehiclesService]
})
export class FleetModule {}
