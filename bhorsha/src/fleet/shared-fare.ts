export const SHARED_PERCENT = 60;
export interface FareRuleRow {
  id: number;
  basePaisa: string;
  perKmPaisa: string;
  baseDistanceM: number;
  ceilingBasePaisa: string;
  ceilingPerKmPaisa: string;
}

export interface SharedFare {
  farePaisa: number;
  ceilingPaisa: number;
  snapshot: Record<string, unknown>;
}

export function quoteSharedFare(
  rule: FareRuleRow,
  vehicleType: string,
  distanceM: number,
): SharedFare {
  const basePaisa = Number(rule.basePaisa);
  const perKmPaisa = Number(rule.perKmPaisa);
  const soloFareTk = Math.round(
    (basePaisa + (perKmPaisa * distanceM) / 1000) / 100,
  );
  const sharedFareTk = Math.round((soloFareTk * SHARED_PERCENT) / 100);

  const ceilingBasePaisa = Number(rule.ceilingBasePaisa);
  const ceilingPerKmPaisa = Number(rule.ceilingPerKmPaisa);
  const extraM = Math.max(distanceM - rule.baseDistanceM, 0);
  const ceilingPaisa =
    ceilingBasePaisa + Math.round((ceilingPerKmPaisa * extraM) / 1000);

  const farePaisa = Math.min(sharedFareTk * 100, ceilingPaisa);
  return {
    farePaisa,
    ceilingPaisa,
    snapshot: {
      shared: true,
      formula: 'calculateQuote',
      fareRuleId: rule.id,
      vehicleType,
      distanceM,
      basePaisa,
      perKmPaisa,
      soloFarePaisa: soloFareTk * 100,
      sharedPercent: SHARED_PERCENT,
      baseDistanceM: rule.baseDistanceM,
      ceilingBasePaisa,
      ceilingPerKmPaisa,
      ceilingPaisa,
      farePaisa,
    },
  };
}