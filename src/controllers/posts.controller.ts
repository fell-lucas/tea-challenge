import { Controller, Post, Body, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { PostService } from '../services/post.service';
import { FeedService } from '../services/feed.service';
import { CreatePostDto } from '../dto/create-post.dto';

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

      this.logger.log(`Post created by user ${userId}: ${post._id}`);

      return {
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        category: post.category,
        createdAt: post.createdAt?.toISOString(),
        updatedAt: post.updatedAt?.toISOString(),
        likeCount: post.likeCount,
        tags: post.tags,
        isActive: post.isActive,
      };
    } catch (error) {
      this.logger.error(`Error creating post for user ${userId}:`, error);
      throw error;
    }
  }
}
