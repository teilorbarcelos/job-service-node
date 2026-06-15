import { FastifyInstance } from 'fastify';
import { auditExplorerRoutes } from './AuditExplorer/AuditExplorer.routes.js';
import { authRoutes } from './Auth/Auth.routes.js';
import { featureRoutes } from './Feature/Feature.routes.js';
import { productRoutes } from './Product/Product.routes.js';
import { roleRoutes } from './Role/Role.routes.js';
import { userRoutes } from './User/User.routes.js';
import { dashboardRoutes } from './Dashboard/Dashboard.routes.js';
import { CONFIG } from '../shared/config/env.js';
// [GENERATOR_IMPORTS]

export async function registerPublicModules(app: FastifyInstance) {
  await app.register(auditExplorerRoutes);
  if (CONFIG.AUTH_MODE !== 'remote') {
    await app.register(authRoutes, { prefix: '/v1' });
  }
}

export async function registerPrivateModules(app: FastifyInstance) {
  await app.register(userRoutes, { prefix: '/v1' });
  await app.register(roleRoutes, { prefix: '/v1' });
  await app.register(featureRoutes, { prefix: '/v1' });
  await app.register(productRoutes, { prefix: '/v1' });
  await app.register(dashboardRoutes, { prefix: '/v1' });
  // [GENERATOR_REGISTRATIONS]
}

