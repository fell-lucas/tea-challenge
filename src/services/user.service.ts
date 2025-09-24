import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../entities/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findOrCreateUser(userId: string): Promise<UserDocument> {
    try {
      // Try to find existing user
      let user = await this.userModel.findOne({ userId, isActive: true });

      if (!user) {
        // Create new user if not found
        user = new this.userModel({
          userId,
          lastSeenAt: new Date(),
          postCount: 0,
          isActive: true,
        });
        await user.save();
        this.logger.log(`Created new user: ${userId}`);
      } else {
        // Update last seen timestamp
        user.lastSeenAt = new Date();
        await user.save();
      }

      return user;
    } catch (error) {
      this.logger.error(`Error finding or creating user ${userId}:`, error);
      throw error;
    }
  }

  async updateLastSeen(userId: string): Promise<void> {
    try {
      await this.userModel.updateOne(
        { userId, isActive: true },
        { lastSeenAt: new Date() },
      );
    } catch (error) {
      this.logger.error(`Error updating last seen for user ${userId}:`, error);
      throw error;
    }
  }

  async incrementPostCount(userId: string): Promise<void> {
    try {
      await this.userModel.updateOne(
        { userId, isActive: true },
        { $inc: { postCount: 1 }, lastSeenAt: new Date() },
      );
    } catch (error) {
      this.logger.error(
        `Error incrementing post count for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async decrementPostCount(userId: string): Promise<void> {
    try {
      await this.userModel.updateOne(
        { userId, isActive: true },
        { $inc: { postCount: -1 }, lastSeenAt: new Date() },
      );
    } catch (error) {
      this.logger.error(
        `Error decrementing post count for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ userId, isActive: true });
    } catch (error) {
      this.logger.error(`Error finding user ${userId}:`, error);
      throw error;
    }
  }

  async getActiveUserCount(): Promise<number> {
    try {
      return await this.userModel.countDocuments({ isActive: true });
    } catch (error) {
      this.logger.error('Error getting active user count:', error);
      throw error;
    }
  }

  async getRecentUsers(limit: number = 10): Promise<UserDocument[]> {
    try {
      return await this.userModel
        .find({ isActive: true })
        .sort({ lastSeenAt: -1 })
        .limit(limit);
    } catch (error) {
      this.logger.error('Error getting recent users:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.userModel.updateOne({ userId }, { isActive: false });
      this.logger.log(`Soft deleted user: ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting user ${userId}:`, error);
      throw error;
    }
  }

  async clearAllUsers(): Promise<void> {
    try {
      await this.userModel.deleteMany({});
      this.logger.log('Cleared all users');
    } catch (error) {
      this.logger.error('Error clearing all users:', error);
      throw error;
    }
  }
}
