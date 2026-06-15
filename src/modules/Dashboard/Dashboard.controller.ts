import { FastifyReply, FastifyRequest } from 'fastify';
import { DashboardService } from './Dashboard.service.js';

export class DateTimeHelper {
  static parseStartDate(dateStr?: string, defaultDaysAgo = 30): Date {
    if (!dateStr) {
      const d = new Date();
      d.setDate(d.getDate() - defaultDaysAgo);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const parsed = new Date(dateStr + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      const d = new Date();
      d.setDate(d.getDate() - defaultDaysAgo);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return parsed;
  }

  static parseEndDate(dateStr?: string): Date {
    if (!dateStr) {
      return new Date();
    }
    const parsed = new Date(dateStr + 'T23:59:59.999');
    if (isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  }
}

export class DashboardController {
  constructor(private service: DashboardService) {}

  async getStats(request: FastifyRequest, _reply: FastifyReply) {
    const { createdAt_start, createdAt_end } = request.query as {
      createdAt_start?: string;
      createdAt_end?: string;
    };

    const start = DateTimeHelper.parseStartDate(createdAt_start);
    const end = DateTimeHelper.parseEndDate(createdAt_end);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    return this.service.getStats(start, end, tz);
  }
}
