import { FastifyInstance } from 'fastify';
import { DashboardController } from './Dashboard.controller.js';
import { DashboardService } from './Dashboard.service.js';
import { DashboardRepository } from './Dashboard.repository.js';
import { registerGetRoute } from '../../core/RouteFactory.js';
import { GetDashboardStatsConfig } from './Dashboard.config.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  const repository = new DashboardRepository();
  const service = new DashboardService(repository);
  const controller = new DashboardController(service);

  registerGetRoute(
    fastify,
    '/dashboard/stats',
    GetDashboardStatsConfig,
    controller.getStats.bind(controller)
  );
}
