import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validateEnv } from './config/env.validation.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { FleetModule } from './modules/fleet/fleet.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { NotifyModule } from './modules/notify/notify.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';
import { SharingModule } from './modules/sharing/sharing.module.js';
import { TripsModule } from './modules/trips/trips.module.js';
import { TrustModule } from './modules/trust/trust.module.js';

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
    // The modules of README section 8, each in src/modules, each writing only its own tables
    // (doc/databaseSQL.md section 1). Routes are registered in this order, and Swagger lists
    // its groups in that order: Driver Domain, then Auth, Users, Drivers (Admin), Fare rules,
    // then Support.
    FleetModule,
    IdentityModule,
    PricingModule,
    TripsModule,
    SharingModule,
    SafetyModule,
    TrustModule,
    AuditModule,
    NotifyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here (not in main.ts) so e2e tests that build AppModule get it too.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
