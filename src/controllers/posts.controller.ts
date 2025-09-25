import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostDetailsResponseDto } from '../dto/post-details-response.dto';
import { FeedService } from '../services/feed.service';
import { PostService } from '../services/post.service';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name);

  constructor(
    private postService: PostService,
    private feedService: FeedService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new post',
    description:
      'Creates a new post in the system (for testing and admin purposes)',
  })
  @ApiHeader({
    name: 'X-User-Id',
    description: 'User identifier (UUID v7 format)',
    required: true,
    schema: {
      type: 'string',
      pattern:
        '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
    type: PostDetailsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data or missing X-User-Id header',
  })
  async createPost(@Body() createPostDto: CreatePostDto, @Req() req: Request) {
    const userId = req.userId!;

    try {
      const post = await this.postService.create(createPostDto, userId);

      await this.feedService.invalidateCache();

      this.logger.log(`Post created by user ${userId}: ${post.id}`);

      return {
        success: true,
        data: post,
      };
    } catch (error) {
      this.logger.error(`Error creating post for user ${userId}:`, error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single post details',
    description:
      'Retrieve detailed information about a specific post (open access)',
  })
  @ApiParam({
    name: 'id',
    description: 'Post ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiHeader({
    name: 'X-User-Id',
    description:
      'Optional user ID to include personal engagement status (UUID v7)',
    required: false,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Post details retrieved successfully',
    type: PostDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Bad request (invalid post ID format)',
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
  })
  async getPostDetails(
    @Param('id') postId: string,
    @Req() req: Request,
  ): Promise<PostDetailsResponseDto> {
    try {
      const userId = req.userId; // Set by OptionalAuthMiddleware (may be undefined)
      this.logger.log(
        `Getting post details for ${postId}${userId ? ` (user: ${userId})` : ' (anonymous)'}`,
      );

      const postDetails = await this.postService.getPostDetails(postId, userId);

      this.logger.log(`Post details retrieved for ${postId}`);

      return {
        success: true,
        data: postDetails,
      };
    } catch (error) {
      this.logger.error(`Error getting post details for ${postId}:`, error);
      throw error;
    }
  }
}
