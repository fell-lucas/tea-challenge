import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../entities/post.entity';
import { CreatePostDto } from '../dto/create-post.dto';
import { UserService } from './user.service';
import { CategoryService } from './category.service';
import { EngagementService } from './engagement.service';
import {
  PostDetailsDto,
  EngagementMetricsDto,
} from '../dto/post-details-response.dto';
import { EngagementType } from '../entities/user-engagement.entity';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private userService: UserService,
    private categoryService: CategoryService,
    private engagementService: EngagementService,
  ) {}

  async create(
    createPostDto: CreatePostDto,
    userId: string,
  ): Promise<PostDetailsDto> {
    try {
      await this.userService.findOrCreateUser(userId);

      const post = new this.postModel({
        ...createPostDto,
        userId,
        likeCount: 0,
        isActive: true,
        tags: createPostDto.tags || [],
      });

      const savedPost = await post.save();

      await Promise.all([
        this.userService.incrementPostCount(userId),
        this.categoryService.incrementPostCount(createPostDto.category),
      ]);

      this.logger.log(`Created post ${savedPost._id} for user ${userId}`);

      const postDetails: PostDetailsDto = {
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        userId: post.userId,
        category: post.category,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        relevanceScore: post.relevanceScore,
        engagement: {
          likeCount: 0,
          dislikeCount: 0,
          userEngagement: null,
        },
        tags: post.tags,
        isActive: post.isActive,
      };

      return postDetails;
    } catch (error) {
      this.logger.error('Error creating post:', error);
      throw error;
    }
  }

  async findAll(
    category?: string,
    limit: number = 20,
    cursor?: { score: number; postId: string },
  ): Promise<{ posts: PostDocument[]; totalCount: number }> {
    try {
      const filter: any = { isActive: true };

      if (category) {
        filter.category = category;
      }

      const totalCount = await this.postModel.countDocuments(filter);

      let query = this.postModel.find(filter);

      if (cursor) {
        // For cursor pagination, we need to filter based on relevance score and creation time
        // Since relevance score is calculated, we'll use creation time and like count as proxy
        const HOUR_IN_MS = 1000 * 60 * 60;
        const cursorDate = new Date(
          Date.now() - (Math.log(cursor.score) / -0.1) * HOUR_IN_MS,
        );
        query = query.where({
          $or: [
            { createdAt: { $lt: cursorDate } },
            {
              createdAt: cursorDate,
              _id: { $lt: cursor.postId },
            },
          ],
        });
      }

      const posts = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .exec();

      return { posts, totalCount };
    } catch (error) {
      this.logger.error('Error finding posts:', error);
      throw error;
    }
  }

  async setLikeCount(
    id: string,
    likeCount: number,
  ): Promise<PostDocument | null> {
    try {
      return await this.postModel.findByIdAndUpdate(
        id,
        { likeCount },
        { new: true },
      );
    } catch (error) {
      this.logger.error(`Error setting likes for post ${id}:`, error);
      throw error;
    }
  }

  async clearAllPosts(): Promise<void> {
    try {
      await this.postModel.deleteMany({});
      this.logger.log('Cleared all posts');
    } catch (error) {
      this.logger.error('Error clearing all posts:', error);
      throw error;
    }
  }

  async getPostDetails(
    postId: string,
    userId?: string,
  ): Promise<PostDetailsDto> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel.findById(postId).exec();
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const engagementMetrics =
        await this.engagementService.getEngagementMetrics(postId);

      let userEngagement: EngagementType | null = null;
      if (userId) {
        userEngagement = await this.engagementService.getUserEngagement(
          userId,
          postId,
        );
      }

      const engagement: EngagementMetricsDto = {
        likeCount: engagementMetrics.likeCount,
        dislikeCount: engagementMetrics.dislikeCount,
        userEngagement,
      };

      const postDetails: PostDetailsDto = {
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        userId: post.userId,
        category: post.category,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        relevanceScore: post.relevanceScore,
        engagement,
        tags: post.tags,
        isActive: post.isActive,
      };

      this.logger.log(
        `Retrieved post details for ${postId}${userId ? ` (user: ${userId})` : ' (anonymous)'}`,
      );
      return postDetails;
    } catch (error) {
      this.logger.error(`Error getting post details for ${postId}:`, error);
      throw error;
    }
  }
}
