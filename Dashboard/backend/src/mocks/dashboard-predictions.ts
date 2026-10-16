import { PredictionRecordSchema } from '@shokai/contracts';

const modelMetadata = {
  modelId: 'mock-model-not-selected',
  modelVersion: '0.0.0',
  generatedAt: '2026-09-10T12:00:00Z',
} as const;

const predictionSeeds = [
  { predictionId: 'MOCK-PRED-001', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'advanced', providerState: 'AM', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 184.5, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-002', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'staging', providerState: 'PA', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 132, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-003', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'adjuvant', providerState: 'AC', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 91.25, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-004', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'neoadjuvant', providerState: 'RO', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 48, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-005', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'staging', providerState: 'AP', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 37.75, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-006', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'advanced', providerState: 'RR', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 21.5, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-007', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'neoadjuvant', providerState: 'TO', referenceMonth: '2026-08', forecastMonth: '2026-09', predictedDemandVolume: 13, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-008', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'advanced', providerState: 'PA', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 205, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-009', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'adjuvant', providerState: 'AM', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 156.25, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-010', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'neoadjuvant', providerState: 'RO', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 112.5, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-011', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'staging', providerState: 'TO', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 74, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-012', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'adjuvant', providerState: 'AC', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 53.75, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-013', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'advanced', providerState: 'RR', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 29, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-014', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'staging', providerState: 'AP', referenceMonth: '2026-09', forecastMonth: '2026-10', predictedDemandVolume: 18.25, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-015', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'advanced', providerState: 'PA', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 221.5, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-016', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'neoadjuvant', providerState: 'AM', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 143, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-017', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'adjuvant', providerState: 'RO', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 104.75, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-018', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'staging', providerState: 'AC', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 68.5, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-019', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'neoadjuvant', providerState: 'AP', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 44.25, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-020', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'advanced', providerState: 'TO', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 32, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-021', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'staging', providerState: 'RR', referenceMonth: '2026-10', forecastMonth: '2026-11', predictedDemandVolume: 16.5, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-022', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'advanced', providerState: 'AM', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 238.75, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-023', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'adjuvant', providerState: 'PA', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 167, opportunityTier: 'high' },
  { predictionId: 'MOCK-PRED-024', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'neoadjuvant', providerState: 'TO', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 119.25, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-025', operatorId: 'MOCK-OP-001', operatorName: 'Mock Operator Aurora', treatmentLine: 'staging', providerState: 'RO', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 82, opportunityTier: 'medium' },
  { predictionId: 'MOCK-PRED-026', operatorId: 'MOCK-OP-002', operatorName: 'Mock Operator Boreal', treatmentLine: 'adjuvant', providerState: 'AC', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 57.5, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-027', operatorId: 'MOCK-OP-003', operatorName: 'Mock Operator Canopy', treatmentLine: 'advanced', providerState: 'AP', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 34.75, opportunityTier: 'low' },
  { predictionId: 'MOCK-PRED-028', operatorId: 'MOCK-OP-004', operatorName: 'Mock Operator Delta', treatmentLine: 'staging', providerState: 'RR', referenceMonth: '2026-11', forecastMonth: '2026-12', predictedDemandVolume: 19, opportunityTier: 'low' },
] as const;

/** Fictitious records validated and frozen once at module initialization. */
export const dashboardPredictions = Object.freeze(
  PredictionRecordSchema.array()
    .parse(
      predictionSeeds.map((prediction) => ({
        ...prediction,
        ...modelMetadata,
        observedDemandVolume: null,
        targetMeasured: false,
        isStructuralZero: false,
        hasRecentHistory: true,
      })),
    )
    .map((prediction) => Object.freeze(prediction)),
);
