import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle])],
})
export class FleetModule {}