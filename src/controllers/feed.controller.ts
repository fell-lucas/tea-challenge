import { Controller, Get, Query, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeedService } from '../services/feed.service';
import { UserService } from '../services/user.service';
import { FeedQueryDto } from '../dto/feed-query.dto';
import { FeedResponseDto } from '../dto/feed-response.dto';

@ApiTags('Feed')
@Controller('feed')
export class FeedController {
  private readonly logger = new Logger(FeedController.name);

  constructor(
    private feedService: FeedService,
    private userService: UserService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get relevance-ranked post feed',
    description:
      'Returns a paginated list of posts ranked by relevance score (likes + freshness decay)',
  })
  @ApiHeader({
    name: 'X-User-Id',
    description: 'Optional user identifier for tracking (UUID v7 format)',
    required: false,
    schema: {
      type: 'string',
      pattern:
        '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Feed retrieved successfully',
    type: FeedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid parameters or malformed X-User-Id header',
  })
  async getFeed(
    @Query() query: FeedQueryDto,
    @Req() req: Request,
  ): Promise<FeedResponseDto> {
    const userId = req.userId;

    try {
      if (userId) {
        await this.userService.findOrCreateUser(userId);
      }

      const feed = await this.feedService.getFeed(query);

      this.logger.log(
        `Feed requested by user ${userId ?? 'anonymous'}, category: ${query.category ?? 'all'}, limit: ${query.limit ?? 20}`,
      );

      return feed;
    } catch (error) {
      this.logger.error(
        `Error getting feed for user ${userId ?? 'anonymous'}:`,
        error,
      );
      throw error;
    }
  }
}
