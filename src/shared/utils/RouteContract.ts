export type RouteAction = 'view' | 'create' | 'delete' | 'activate';

export interface RouteRateLimit {
  max: number;
  timeWindow: string;
}

export interface RouteConfig {
  feature: string;
  action: RouteAction;
  tag: string;
  summary: string;
  body?: unknown;
  params?: unknown;
  querystring?: unknown;
  response: Record<number, unknown>;
  rateLimit?: RouteRateLimit;
}

/**
 * Helper to define a route configuration with type inference.
 */
export const defineRouteConfig = (config: RouteConfig): RouteConfig => config;
