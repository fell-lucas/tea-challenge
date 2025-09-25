import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type UpdateQuery } from 'mongoose';
import {
  UserEngagement,
  UserEngagementDocument,
  EngagementType,
} from '../entities/user-engagement.entity';
import { Post, PostDocument } from '../entities/post.entity';

interface PostCounterUpdate {
  likeCount?: number;
  dislikeCount?: number;
}

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(UserEngagement.name)
    private userEngagementModel: Model<UserEngagementDocument>,
    @InjectModel(Post.name)
    private postModel: Model<PostDocument>,
  ) {}

  async likePost(
    userId: string,
    postId: string,
  ): Promise<{
    postId: string;
    engagementType: EngagementType;
    success: boolean;
  }> {
    return this.engageWithPost(userId, postId, EngagementType.LIKE);
  }

  async dislikePost(
    userId: string,
    postId: string,
  ): Promise<{
    postId: string;
    engagementType: EngagementType;
    success: boolean;
  }> {
    return this.engageWithPost(userId, postId, EngagementType.DISLIKE);
  }

  async getUserEngagement(
    userId: string,
    postId: string,
  ): Promise<EngagementType | null> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }

    const engagement = await this.userEngagementModel
      .findOne({ userId, postId })
      .exec();

    return engagement ? engagement.engagementType : null;
  }

  private async engageWithPost(
    userId: string,
    postId: string,
    engagementType: EngagementType,
  ): Promise<{
    postId: string;
    engagementType: EngagementType;
    success: boolean;
  }> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }

    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingEngagement = await this.userEngagementModel
      .findOne({ userId, postId })
      .exec();

    if (existingEngagement) {
      // Idempotent behavior - if same engagement type, return success
      if (existingEngagement.engagementType === engagementType) {
        return {
          postId,
          engagementType,
          success: true,
        };
      }

      // Update existing engagement (transition from like to dislike or vice versa)
      const oldEngagementType = existingEngagement.engagementType;
      existingEngagement.engagementType = engagementType;

      await existingEngagement.save();

      await this.updatePostCounters(postId, oldEngagementType, engagementType);
    } else {
      const newEngagement = new this.userEngagementModel({
        userId,
        postId,
        engagementType,
      });
      await newEngagement.save();

      await this.updatePostCounters(postId, null, engagementType);
    }

    await this.postModel
      .findByIdAndUpdate(postId, { engagementUpdatedAt: new Date() })
      .exec();

    return {
      postId,
      engagementType,
      success: true,
    };
  }

  private async updatePostCounters(
    postId: string,
    oldEngagementType: EngagementType | null,
    newEngagementType: EngagementType,
  ): Promise<void> {
    const updateQuery: UpdateQuery<PostDocument> = {};

    if (oldEngagementType === EngagementType.LIKE) {
      updateQuery.$inc = { likeCount: -1 };
    } else if (oldEngagementType === EngagementType.DISLIKE) {
      updateQuery.$inc = { dislikeCount: -1 };
    }

    if (newEngagementType === EngagementType.LIKE) {
      updateQuery.$inc ??= {} as PostCounterUpdate;
      const incUpdate = updateQuery.$inc as PostCounterUpdate;
      incUpdate.likeCount = (incUpdate.likeCount ?? 0) + 1;
    } else if (newEngagementType === EngagementType.DISLIKE) {
      updateQuery.$inc ??= {} as PostCounterUpdate;
      const incUpdate = updateQuery.$inc as PostCounterUpdate;
      incUpdate.dislikeCount = (incUpdate.dislikeCount ?? 0) + 1;
    }

    if (updateQuery.$inc) {
      await this.postModel.findByIdAndUpdate(postId, updateQuery).exec();
    }
  }

  async getEngagementMetrics(postId: string): Promise<{
    likeCount: number;
    dislikeCount: number;
  }> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }

    const post = await this.postModel
      .findById(postId)
      .select('likeCount dislikeCount')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return {
      likeCount: post.likeCount,
      dislikeCount: post.dislikeCount,
    };
  }
}
