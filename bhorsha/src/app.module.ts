import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validateEnv } from './config/env.validation.js';
import { FleetModule } from './fleet/fleet.module.js';
import { NotifyModule } from './notify/notify.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { SafetyModule } from './safety/safety.module.js';
import { TripsModule } from './trips/trips.module.js';
import { UsersModule } from './users/users.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SharingModule } from './modules/sharing/sharing.module.js';
import { TrustModule } from './modules/trust/trust.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // reads bhorsha/.env
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<string>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD') || '',
        database: config.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false, // the Docker image already creates the tables
        parseInt8: true,
        logging: config.get('DB_LOGGING') === 'true',
        extra: { max: Number(config.get('DB_POOL_MAX', 10)) },
      }),
    }),
    // FleetModule must stay before TripsModule: GET /rides/open has to be
    // registered before GET /rides/:id, or ":id" would catch "open".
    UsersModule,
    FleetModule,
    NotifyModule,
    PricingModule,
    SafetyModule,
    TripsModule,
    IdentityModule,
    SharingModule,
    TrustModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here (not in main.ts) so e2e tests that build AppModule get it too.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
