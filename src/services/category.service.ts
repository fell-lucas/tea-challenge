import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Category,
  CategoryDocument,
  PREDEFINED_CATEGORIES,
  type CategoryName,
} from '../entities/category.entity';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async seedCategories(): Promise<CategoryDocument[]> {
    try {
      await this.categoryModel.deleteMany({});

      const categories = await this.categoryModel.insertMany(
        PREDEFINED_CATEGORIES.map((cat) => ({
          ...cat,
          isActive: true,
          postCount: 0,
        })),
      );

      this.logger.log(`Seeded ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.logger.error('Error seeding categories:', error);
      throw error;
    }
  }

  async findAll(): Promise<CategoryDocument[]> {
    try {
      return await this.categoryModel
        .find({ isActive: true })
        .sort({ name: 1 });
    } catch (error) {
      this.logger.error('Error finding categories:', error);
      throw error;
    }
  }

  async findByName(name: CategoryName): Promise<CategoryDocument | null> {
    try {
      return await this.categoryModel.findOne({ name, isActive: true });
    } catch (error) {
      this.logger.error(`Error finding category ${name}:`, error);
      throw error;
    }
  }

  async incrementPostCount(categoryName: CategoryName): Promise<void> {
    try {
      await this.categoryModel.updateOne(
        { name: categoryName, isActive: true },
        { $inc: { postCount: 1 } },
      );
    } catch (error) {
      this.logger.error(
        `Error incrementing post count for category ${categoryName}:`,
        error,
      );
      throw error;
    }
  }

  async decrementPostCount(categoryName: CategoryName): Promise<void> {
    try {
      await this.categoryModel.updateOne(
        { name: categoryName, isActive: true },
        { $inc: { postCount: -1 } },
      );
    } catch (error) {
      this.logger.error(
        `Error decrementing post count for category ${categoryName}:`,
        error,
      );
      throw error;
    }
  }

  async getCategoryCount(): Promise<number> {
    try {
      return await this.categoryModel.countDocuments({ isActive: true });
    } catch (error) {
      this.logger.error('Error getting category count:', error);
      throw error;
    }
  }

  getDisplayName(categoryName: CategoryName): string {
    const category = PREDEFINED_CATEGORIES.find(
      (cat) => cat.name === categoryName,
    );
    return category
      ? category.displayName
      : categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  }

  async clearAllCategories(): Promise<void> {
    try {
      await this.categoryModel.deleteMany({});
      this.logger.log('Cleared all categories');
    } catch (error) {
      this.logger.error('Error clearing all categories:', error);
      throw error;
    }
  }
}
