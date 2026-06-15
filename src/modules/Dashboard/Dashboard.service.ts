import { DashboardRepository } from './Dashboard.repository.js';

export class DashboardService {
  constructor(private repository: DashboardRepository) {}

  async getStats(start: Date, end: Date, tz: string) {
    const [userStats, productStats, productsPerUser] = await Promise.all([
      this.repository.getUserStats(start, end, tz),
      this.repository.getProductStats(start, end, tz),
      this.repository.getProductsPerUser(start, end)
    ]);

    return {
      userCreationStats: userStats || [],
      productCreationStats: productStats || [],
      productsPerUser: productsPerUser || []
    };
  }
}
