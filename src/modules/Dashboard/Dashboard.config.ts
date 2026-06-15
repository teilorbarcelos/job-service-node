import { defineRouteConfig } from '../../shared/utils/RouteContract.js';
import { DashboardStatsResponseSchema } from './Dashboard.schema.js';

const TAG = 'Dashboard';
const FEATURE = 'dashboard';

export const GetDashboardStatsConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'Get dashboard statistics',
  querystring: {
    type: 'object',
    properties: {
      createdAt_start: { type: 'string' },
      createdAt_end: { type: 'string' }
    }
  },
  response: { 200: DashboardStatsResponseSchema }
});
