export enum VehicleType {
  BIKE = 'BIKE',
  CAR = 'CAR',
  CNG = 'CNG',
}

export const SEAT_CAPACITY: Record<VehicleType, number> = {
  [VehicleType.BIKE]: 1,
  [VehicleType.CAR]: 3,
  [VehicleType.CNG]: 2,
};