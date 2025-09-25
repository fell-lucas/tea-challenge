import { Controller, Post, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SeedingService } from '../services/seeding.service';
import { SeedResponseDto } from '../dto/seed-response.dto';

@ApiTags('Admin')
@Controller('admin')
export class SeedController {
  private readonly logger = new Logger(SeedController.name);

  constructor(private seedingService: SeedingService) {}

  @Post('seed')
  @ApiOperation({
    summary: 'Seed database with test data',
    description:
      'Clears existing data and seeds database with 5000+ posts across categories',
  })
  @ApiResponse({
    status: 200,
    description: 'Database seeded successfully',
    type: SeedResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Seeding failed',
  })
  async seedDatabase(@Query('totalPosts') totalPosts: number = 5000) {
    try {
      this.logger.log('Starting database seeding...');

      const result = await this.seedingService.seedAll(totalPosts);

      this.logger.log(
        `Database seeding completed: ${result.postsCreated} posts, ${result.categoriesCreated} categories, ${result.usersCreated} users`,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Database seeding failed:', error);
      throw error;
    }
  }
}
