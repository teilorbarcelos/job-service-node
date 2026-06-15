import { Static, Type } from '@sinclair/typebox';

export const TimeSeriesStatSchema = Type.Object({
  date: Type.String(),
  count: Type.Integer(),
});

export type TimeSeriesStat = Static<typeof TimeSeriesStatSchema>;

export const UserProductStatSchema = Type.Object({
  userId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  userName: Type.String(),
  count: Type.Integer(),
});

export type UserProductStat = Static<typeof UserProductStatSchema>;

export const DashboardStatsResponseSchema = Type.Object({
  userCreationStats: Type.Array(TimeSeriesStatSchema),
  productCreationStats: Type.Array(TimeSeriesStatSchema),
  productsPerUser: Type.Array(UserProductStatSchema),
});

export type DashboardStatsResponse = Static<typeof DashboardStatsResponseSchema>;
