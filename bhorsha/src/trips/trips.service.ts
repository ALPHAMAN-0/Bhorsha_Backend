import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SEAT_CAPACITY, VehicleType } from '../fleet/vehicle-type.js';
import { PricingService } from '../pricing/pricing.service.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { JoinRequest, JoinRequestStatus } from './entities/join-request.entity.js';
import { Rating } from './entities/rating.entity.js';
import { PassengerStatus, RidePassenger } from './entities/ride-passenger.entity.js';
import { Ride, RideStatus } from './entities/ride.entity.js';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Ride)
    private readonly rideRepo: Repository<Ride>,
    @InjectRepository(RidePassenger)
    private readonly passengerRepo: Repository<RidePassenger>,
    @InjectRepository(JoinRequest)
    private readonly joinRepo: Repository<JoinRequest>,
    @InjectRepository(Rating)
    private readonly ratingRepo: Repository<Rating>,
    private readonly pricingService: PricingService,
    private readonly dataSource: DataSource,
  ) {}

  async getQuote(
    vehicleType: VehicleType = VehicleType.CAR,
    distanceKm: number = 5.0,
    isShared: boolean = false,
  ) {
    return this.pricingService.calculateQuote(vehicleType, distanceKm, isShared);
  }

  async createRide(riderId: number, dto: CreateRideDto): Promise<Ride> {
    const vType = dto.vehicle_type || VehicleType.CAR;
    const dist = dto.distance_km || 5.0;
    const isShared = dto.is_shared ?? false;

    const quote = await this.pricingService.calculateQuote(vType, dist, isShared);
    const totalCapacity = SEAT_CAPACITY[vType] || 1;

    const ride = this.rideRepo.create({
      rider_id: riderId,
      vehicle_type: vType,
      origin: dto.origin,
      destination: dto.destination,
      origin_lat: dto.origin_lat ?? 23.8103,
      origin_lng: dto.origin_lng ?? 90.4125,
      dest_lat: dto.dest_lat ?? 23.7925,
      dest_lng: dto.dest_lng ?? 90.4078,
      distance_km: dist,
      fare_bdt: quote.total_fare_bdt,
      is_shared: isShared,
      seats_total: isShared ? totalCapacity : 1,
      seats_booked: 1, // Rider takes the 1st seat
      seats_free: isShared ? totalCapacity - 1 : 0,
      status: RideStatus.REQUESTED,
    });

    const saved = await this.rideRepo.save(ride);

    // Register rider as passenger #1
    await this.passengerRepo.save(
      this.passengerRepo.create({
        ride_id: saved.id,
        rider_id: riderId,
        passenger_id: riderId,
        seats: 1,
        fare_share_bdt: quote.fare_share_bdt,
        status: PassengerStatus.CONFIRMED,
      }),
    );

    return saved;
  }

  async findMyRides(userId: number, page: number = 1, limit: number = 10) {
    // Check rides where user is rider, driver, or co-passenger
    const passengerRecords = await this.passengerRepo.find({
      where: [{ passenger_id: userId }, { rider_id: userId }],
      select: { ride_id: true },
    });
    const passengerRideIds = [...new Set(passengerRecords.map((p) => p.ride_id))];

    const qb = this.rideRepo.createQueryBuilder('ride');
    if (passengerRideIds.length > 0) {
      qb.where(
        'ride.rider_id = :userId OR ride.driver_id = :userId OR ride.id IN (:...passengerRideIds)',
        { userId, passengerRideIds },
      );
    } else {
      qb.where('ride.rider_id = :userId OR ride.driver_id = :userId', { userId });
    }

    qb.orderBy('ride.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findAllRides(status?: RideStatus, page: number = 1, limit: number = 20) {
    const query = this.rideRepo.createQueryBuilder('ride');
    if (status) {
      query.where('ride.status = :status', { status });
    }
    query.orderBy('ride.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await query.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string | number): Promise<Ride> {
    const numId = Number(id);
    const ride = await this.rideRepo.findOne({ where: { id: numId } });
    if (!ride) {
      throw new NotFoundException(`Ride #${id} not found`);
    }
    return ride;
  }

  async cancelRide(id: string | number, userId: number): Promise<Ride> {
    const ride = await this.findOne(id);
    const numId = Number(id);
    if (ride.rider_id !== userId && ride.driver_id !== userId) {
      throw new ForbiddenException('You are not authorized to cancel this ride');
    }
    if (ride.status === RideStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed ride');
    }
    if (ride.status === RideStatus.CANCELLED) {
      throw new BadRequestException('Ride is already cancelled');
    }

    // Close any live passengers on this ride to satisfy database update guards
    await this.passengerRepo.update(
      { ride_id: numId, status: PassengerStatus.CONFIRMED },
      { status: PassengerStatus.CANCELLED, cancelled_at: new Date() },
    );

    ride.status = RideStatus.CANCELLED;
    ride.cancel_reason = 'RIDER_CANCELLED';
    ride.cancelled_at = new Date();
    return this.rideRepo.save(ride);
  }

  async getNearbyOffers(lat: number = 23.8103, lng: number = 90.4125, radiusKm: number = 5.0) {
    return this.rideRepo
      .createQueryBuilder('ride')
      .where('ride.status = :status', { status: RideStatus.REQUESTED })
      .andWhere('ride.is_shared = true')
      .andWhere('ride.seats_booked < ride.seats_total')
      .orderBy('ride.created_at', 'DESC')
      .take(15)
      .getMany();
  }

  async createJoinRequest(passengerId: number, dto: CreateJoinRequestDto): Promise<JoinRequest> {
    const ride = await this.findOne(dto.ride_id);

    if (!ride.is_shared) {
      throw new BadRequestException('This ride is not open for seat sharing');
    }
    if (ride.rider_id === passengerId) {
      throw new BadRequestException('You cannot join your own ride');
    }
    if (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.MATCHED) {
      throw new BadRequestException(`Cannot join a ride with status ${ride.status}`);
    }
    if (ride.seats_booked >= ride.seats_total) {
      throw new ConflictException('No available seats remaining on this ride');
    }

    const requestedSeats = dto.seats || 1;
    const remainingSeats = ride.seats_total - ride.seats_booked;
    if (requestedSeats > remainingSeats) {
      throw new ConflictException(
        `Requested ${requestedSeats} seats, but only ${remainingSeats} remaining`,
      );
    }

    const quote = await this.pricingService.calculateQuote(
      ride.vehicle_type,
      Number(ride.distance_km),
      true,
    );

    const joinReq = this.joinRepo.create({
      ride_id: dto.ride_id,
      rider_id: passengerId,
      passenger_id: passengerId,
      pickup_lat: dto.pickup_lat ?? ride.origin_lat,
      pickup_lng: dto.pickup_lng ?? ride.origin_lng,
      drop_lat: dto.dropoff_lat ?? ride.dest_lat,
      drop_lng: dto.dropoff_lng ?? ride.dest_lng,
      dropoff_lat: dto.dropoff_lat ?? ride.dest_lat,
      dropoff_lng: dto.dropoff_lng ?? ride.dest_lng,
      seats: requestedSeats,
      fare_share_bdt: quote.fare_share_bdt * requestedSeats,
      status: JoinRequestStatus.PENDING,
    });

    return this.joinRepo.save(joinReq);
  }

  async findMyJoinRequests(userId: number) {
    return this.joinRepo.find({
      where: [{ passenger_id: userId }, { rider_id: userId }],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Concurrency Safe: Accepts or Declines join request using Pessimistic Lock
   */
  async respondJoinRequest(
    requestId: number,
    responderUserId: number,
    accept: boolean,
  ): Promise<JoinRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const joinReq = await queryRunner.manager.findOne(JoinRequest, {
        where: { id: requestId },
      });
      if (!joinReq) {
        throw new NotFoundException(`Join request #${requestId} not found`);
      }
      if (joinReq.status !== JoinRequestStatus.PENDING) {
        throw new BadRequestException(`Join request already ${joinReq.status}`);
      }

      // Lock ride row with PESSIMISTIC_WRITE (SELECT ... FOR UPDATE)
      const ride = await queryRunner.manager
        .createQueryBuilder(Ride, 'ride')
        .setLock('pessimistic_write')
        .where('ride.id = :id', { id: joinReq.ride_id })
        .getOne();

      if (!ride) {
        throw new NotFoundException(`Ride #${joinReq.ride_id} not found`);
      }

      // Authorization check: Only ride host or assigned driver can accept/decline
      if (ride.rider_id !== responderUserId && ride.driver_id !== responderUserId) {
        throw new ForbiddenException(
          'Only the ride host or assigned driver can respond to join requests',
        );
      }

      if (!accept) {
        joinReq.status = JoinRequestStatus.DECLINED;
        joinReq.decided_at = new Date();
        const saved = await queryRunner.manager.save(joinReq);
        await queryRunner.commitTransaction();
        return saved;
      }

      // Strict capacity check
      const remainingSeats = ride.seats_total - ride.seats_booked;
      if (remainingSeats < joinReq.seats) {
        throw new ConflictException(
          `Seat booking conflict: ${joinReq.seats} requested, only ${remainingSeats} available`,
        );
      }

      // Increment booked seats and decrement free seats
      ride.seats_booked += joinReq.seats;
      ride.seats_free = Math.max(0, (ride.seats_free ?? (ride.seats_total - ride.seats_booked)) - joinReq.seats);
      await queryRunner.manager.save(ride);

      // Register passenger
      const passenger = queryRunner.manager.create(RidePassenger, {
        ride_id: ride.id,
        rider_id: joinReq.passenger_id ?? joinReq.rider_id,
        passenger_id: joinReq.passenger_id ?? joinReq.rider_id,
        join_request_id: joinReq.id,
        seats: joinReq.seats,
        fare_share_bdt: joinReq.fare_share_bdt,
        status: PassengerStatus.CONFIRMED,
      });
      await queryRunner.manager.save(passenger);

      joinReq.status = JoinRequestStatus.ACCEPTED;
      joinReq.decided_at = new Date();
      const updatedReq = await queryRunner.manager.save(joinReq);

      await queryRunner.commitTransaction();
      return updatedReq;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async rateRide(raterId: number, dto: CreateRatingDto): Promise<Rating> {
    const ride = await this.findOne(dto.ride_id);

    // Verify rater is a participant (host rider, driver, or co-passenger)
    const isPassenger = await this.passengerRepo.findOne({
      where: [
        { ride_id: dto.ride_id, passenger_id: raterId },
        { ride_id: dto.ride_id, rider_id: raterId },
      ],
    });
    if (ride.rider_id !== raterId && ride.driver_id !== raterId && !isPassenger) {
      throw new ForbiddenException('Only ride participants can submit a rating');
    }

    const rating = this.ratingRepo.create({
      ride_id: dto.ride_id,
      from_user_id: raterId,
      to_user_id: dto.ratee_id,
      rater_id: raterId,
      ratee_id: dto.ratee_id,
      stars: dto.score,
      score: dto.score,
      comment: dto.comment || null,
    });
    return this.ratingRepo.save(rating);
  }
}
