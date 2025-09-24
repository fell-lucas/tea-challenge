import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../entities/post.entity';
import { CreatePostDto } from '../dto/create-post.dto';
import { UserService } from './user.service';
import { CategoryService } from './category.service';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private userService: UserService,
    private categoryService: CategoryService,
  ) {}

  async create(
    createPostDto: CreatePostDto,
    userId: string,
  ): Promise<PostDocument> {
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
      return savedPost;
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

      // Build query for cursor pagination
      let query = this.postModel.find(filter);

      if (cursor) {
        // For cursor pagination, we need to filter based on relevance score and creation time
        // Since relevance score is calculated, we'll use creation time and like count as proxy
        const cursorDate = new Date(
          Date.now() - (Math.log(cursor.score) / -0.1) * 60 * 60 * 1000,
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

  async findById(id: string): Promise<PostDocument | null> {
    try {
      return await this.postModel.findOne({ _id: id, isActive: true });
    } catch (error) {
      this.logger.error(`Error finding post ${id}:`, error);
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    limit: number = 10,
  ): Promise<PostDocument[]> {
    try {
      return await this.postModel
        .find({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      this.logger.error(`Error finding posts for user ${userId}:`, error);
      throw error;
    }
  }

  async incrementLikes(id: string): Promise<PostDocument | null> {
    try {
      return await this.postModel.findByIdAndUpdate(
        id,
        { $inc: { likeCount: 1 } },
        { new: true },
      );
    } catch (error) {
      this.logger.error(`Error incrementing likes for post ${id}:`, error);
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

  async delete(id: string): Promise<void> {
    try {
      const post = await this.postModel.findById(id);
      if (post) {
        await this.postModel.updateOne({ _id: id }, { isActive: false });

        // Update counters
        await Promise.all([
          this.userService.decrementPostCount(post.userId),
          this.categoryService.decrementPostCount(post.category),
        ]);

        this.logger.log(`Soft deleted post ${id}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting post ${id}:`, error);
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

  async getPostCount(category?: string): Promise<number> {
    try {
      const filter: any = { isActive: true };
      if (category) {
        filter.category = category;
      }
      return await this.postModel.countDocuments(filter);
    } catch (error) {
      this.logger.error('Error getting post count:', error);
      throw error;
    }
  }
}
