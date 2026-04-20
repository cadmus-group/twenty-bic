import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('healthz')
  healthCheck(): { status: string } {
    return { status: 'ok' };
  }
}
