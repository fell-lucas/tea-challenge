import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CacheService } from '../services/cache.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectConnection() private connection: Connection,
    private cacheService: CacheService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns the health status of the service and its dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
  })
  async getHealth() {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    try {
      const dbHealth = await this.checkDatabase();

      const cacheHealth = await this.cacheService.getInfo();

      const memoryUsage = process.memoryUsage();
      const memoryInfo = {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round(
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        ),
      };

      const isHealthy = dbHealth.status === 'ok' && cacheHealth.status === 'ok';
      const status = isHealthy ? 'ok' : 'error';

      const healthResponse = {
        status,
        timestamp,
        uptime,
        dependencies: {
          database: dbHealth,
          cache: cacheHealth,
        },
        memory: memoryInfo,
      };

      this.logger.log(`Health check: ${status}`);

      if (!isHealthy) {
        throw new Error('Service unhealthy');
      }

      return healthResponse;
    } catch (error) {
      this.logger.error('Health check failed:', error);

      return {
        status: 'error',
        timestamp,
        uptime,
        dependencies: {
          database: { status: 'error', responseTime: 0 },
          cache: { status: 'error', responseTime: 0 },
        },
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
        },
      };
    }
  }

  private async checkDatabase(): Promise<{
    status: string;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      // Simple ping to check database connectivity
      await this.connection.db?.admin().ping();
      const responseTime = Date.now() - startTime;
      return { status: 'ok', responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Database health check failed:', error);
      return { status: 'error', responseTime };
    }
  }
}
