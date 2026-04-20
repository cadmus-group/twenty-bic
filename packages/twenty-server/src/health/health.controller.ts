import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  // Keep a lightweight readiness endpoint for platform healthchecks.
  // This avoids false negatives from richer health modules.
  @Get('railway-healthz')
  railwayHealthCheck(): { status: string } {
    return { status: 'ok' };
  }

  @Get('healthz')
  healthCheck(): { status: string } {
    return { status: 'ok' };
  }
}
