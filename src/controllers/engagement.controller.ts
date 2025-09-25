import { Controller, Logger, Param, Put, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { EngagementResponseDto } from '../dto/engagement.dto';
import { EngagementService } from '../services/engagement.service';

@ApiTags('Post Engagement')
@Controller('posts')
export class EngagementController {
  private readonly logger = new Logger(EngagementController.name);

  constructor(private readonly engagementService: EngagementService) {}

  @Put(':id/like')
  @ApiOperation({
    summary: 'Like a post',
    description:
      'Add or maintain a like for a specific post (idempotent operation)',
  })
  @ApiParam({
    name: 'id',
    description: 'Post ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiHeader({
    name: 'X-User-Id',
    description: 'User ID for authentication (UUID v7)',
    required: true,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Post liked successfully (or already liked)',
    type: EngagementResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Bad request (invalid post ID or user ID format)',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing or invalid X-User-Id header)',
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
  })
  async likePost(
    @Param('id') postId: string,
    @Req() req: Request,
  ): Promise<EngagementResponseDto> {
    try {
      const userId = req.userId!; // Set by RequiredAuthMiddleware

      const result = await this.engagementService.likePost(userId, postId);

      this.logger.log(`Post ${postId} liked by user ${userId}`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error liking post ${postId}:`, error);
      throw error;
    }
  }

  @Put(':id/dislike')
  @ApiOperation({
    summary: 'Dislike a post',
    description:
      'Add or maintain a dislike for a specific post (idempotent operation)',
  })
  @ApiParam({
    name: 'id',
    description: 'Post ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiHeader({
    name: 'X-User-Id',
    description: 'User ID for authentication (UUID v7)',
    required: true,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Post disliked successfully (or already disliked)',
    type: EngagementResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Bad request (invalid post ID or user ID format)',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing or invalid X-User-Id header)',
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
  })
  async dislikePost(
    @Param('id') postId: string,
    @Req() req: Request,
  ): Promise<EngagementResponseDto> {
    try {
      const userId = req.userId!; // Set by RequiredAuthMiddleware

      const result = await this.engagementService.dislikePost(userId, postId);

      this.logger.log(`Post ${postId} disliked by user ${userId}`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error disliking post ${postId}:`, error);
      throw error;
    }
  }
}
