import { FastifyInstance, RouteHandlerMethod, RouteShorthandOptions, RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression } from 'fastify';
import { checkPermission } from '../api/hooks/auth.hook.js';
import { createRouteSchema, StrictRouteSchema } from '../shared/utils/schema.util.js';
import { RouteConfig } from '../shared/utils/RouteContract.js';

type TypedHandler<TBody = unknown, TParams = unknown, TQuery = unknown> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  { Body: TBody; Params: TParams; Querystring: TQuery }
>;

function buildRouteConfig(config: RouteConfig, schema: StrictRouteSchema): RouteShorthandOptions {
  const opts: RouteShorthandOptions = {
    schema: createRouteSchema(schema),
    preHandler: [checkPermission(config.feature, config.action)],
  };
  if (config.rateLimit) {
    (opts as Record<string, unknown>).config = { rateLimit: config.rateLimit };
  }
  return opts;
}

export const registerPostRoute = <TBody = unknown, TParams = unknown, TQuery = unknown>(
  fastify: FastifyInstance,
  path: string,
  config: RouteConfig,
  handler: TypedHandler<TBody, TParams, TQuery>
) => {
  const schema: StrictRouteSchema = {
    tags: [config.tag],
    summary: config.summary,
    response: config.response
  };

  if (config.body) schema.body = config.body;
  if (config.params) schema.params = config.params;
  if (config.querystring) schema.querystring = config.querystring;

  fastify.post<{ Body: TBody; Params: TParams; Querystring: TQuery }>(path, buildRouteConfig(config, schema), handler);
};

export const registerGetRoute = <TParams = unknown, TQuery = unknown>(
  fastify: FastifyInstance,
  path: string,
  config: RouteConfig,
  handler: TypedHandler<unknown, TParams, TQuery>
) => {
  const schema: StrictRouteSchema = {
    tags: [config.tag],
    summary: config.summary,
    response: config.response
  };

  if (config.params) schema.params = config.params;
  if (config.querystring) schema.querystring = config.querystring;

  fastify.get<{ Body: unknown; Params: TParams; Querystring: TQuery }>(path, buildRouteConfig(config, schema), handler);
};

export const registerPutRoute = <TBody = unknown, TParams = unknown>(
  fastify: FastifyInstance,
  path: string,
  config: RouteConfig,
  handler: TypedHandler<TBody, TParams, unknown>
) => {
  const schema: StrictRouteSchema = {
    tags: [config.tag],
    summary: config.summary,
    response: config.response
  };

  if (config.params) schema.params = config.params;
  if (config.body) schema.body = config.body;

  fastify.put<{ Body: TBody; Params: TParams; Querystring: unknown }>(path, buildRouteConfig(config, schema), handler);
};

export const registerDeleteRoute = <TParams = unknown>(
  fastify: FastifyInstance,
  path: string,
  config: RouteConfig,
  handler: TypedHandler<unknown, TParams, unknown>
) => {
  const schema: StrictRouteSchema = {
    tags: [config.tag],
    summary: config.summary,
    response: config.response
  };

  if (config.params) schema.params = config.params;

  fastify.delete<{ Body: unknown; Params: TParams; Querystring: unknown }>(path, buildRouteConfig(config, schema), handler);
};

export const registerPatchRoute = <TBody = unknown, TParams = unknown>(
  fastify: FastifyInstance,
  path: string,
  config: RouteConfig,
  handler: TypedHandler<TBody, TParams, unknown>
) => {
  const schema: StrictRouteSchema = {
    tags: [config.tag],
    summary: config.summary,
    response: config.response
  };

  if (config.params) schema.params = config.params;
  if (config.body) schema.body = config.body;

  fastify.patch<{ Body: TBody; Params: TParams; Querystring: unknown }>(path, buildRouteConfig(config, schema), handler);
};
