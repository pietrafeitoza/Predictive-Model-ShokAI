export interface HealthStatus {
  status: 'ok';
  service: 'shokai-api';
}

export class HealthService {
  getStatus(): HealthStatus {
    return { status: 'ok', service: 'shokai-api' };
  }
}
