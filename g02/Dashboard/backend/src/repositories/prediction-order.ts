import type { PredictionRecord } from '@shokai/contracts';

export function comparePredictions(left: PredictionRecord, right: PredictionRecord): number {
  return (
    left.forecastMonth.localeCompare(right.forecastMonth) ||
    right.predictedDemandVolume - left.predictedDemandVolume ||
    left.operatorId.localeCompare(right.operatorId) ||
    left.predictionId.localeCompare(right.predictionId)
  );
}
