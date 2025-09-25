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
      let user = await this.userModel.findOne({ userId, isActive: true });

      if (!user) {
        user = new this.userModel({
          userId,
          lastSeenAt: new Date(),
          postCount: 0,
          isActive: true,
        });
        await user.save();
        this.logger.log(`Created new user: ${userId}`);
      } else {
        user.lastSeenAt = new Date();
        await user.save();
      }

      return user;
    } catch (error) {
      this.logger.error(`Error finding or creating user ${userId}:`, error);
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
