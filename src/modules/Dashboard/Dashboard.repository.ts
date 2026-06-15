import { db } from '../../infra/database/PrismaService.js';
import { TimeSeriesStat, UserProductStat } from './Dashboard.schema.js';

export class DashboardRepository {
  async getUserStats(start: Date, end: Date, tz: string): Promise<TimeSeriesStat[]> {
    return db.$queryRaw<TimeSeriesStat[]>`
      SELECT 
        to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS "date",
        COUNT(*)::integer AS "count"
      FROM "User"
      WHERE created_at >= ${start} 
        AND created_at <= ${end} 
        AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
  }

  async getProductStats(start: Date, end: Date, tz: string): Promise<TimeSeriesStat[]> {
    return db.$queryRaw<TimeSeriesStat[]>`
      SELECT 
        to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS "date",
        COUNT(*)::integer AS "count"
      FROM "Product"
      WHERE created_at >= ${start} 
        AND created_at <= ${end} 
        AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
  }

  async getProductsPerUser(start: Date, end: Date): Promise<UserProductStat[]> {
    return db.$queryRaw<UserProductStat[]>`
      SELECT 
        p.id_user AS "userId",
        u.name AS "userName",
        COUNT(*)::integer AS "count"
      FROM "Product" p
      INNER JOIN "User" u ON p.id_user = u.id
      WHERE p.created_at >= ${start} 
        AND p.created_at <= ${end}
        AND (p.is_deleted = false OR p.is_deleted IS NULL)
      GROUP BY p.id_user, u.name
      ORDER BY "count" DESC
    `;
  }
}
