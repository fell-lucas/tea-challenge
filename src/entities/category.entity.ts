import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({
  timestamps: true,
  collection: 'categories',
})
export class Category {
  @Prop({
    required: true,
    enum: [
      'technology',
      'sports',
      'entertainment',
      'news',
      'lifestyle',
      'health',
      'travel',
      'food',
      'science',
      'business',
    ],
    type: String,
  })
  name!: CategoryName;

  @Prop({ required: true, maxlength: 50 })
  displayName!: string;

  @Prop({ maxlength: 200 })
  description?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0, min: 0 })
  postCount!: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ isActive: 1 });

export type CategoryName = (typeof PREDEFINED_CATEGORIES)[number]['name'];
export const PREDEFINED_CATEGORIES = [
  {
    name: 'technology',
    displayName: 'Technology',
    description: 'Latest tech news and innovations',
  },
  {
    name: 'sports',
    displayName: 'Sports',
    description: 'Sports news, scores, and analysis',
  },
  {
    name: 'entertainment',
    displayName: 'Entertainment',
    description: 'Movies, music, and celebrity news',
  },
  {
    name: 'news',
    displayName: 'News',
    description: 'Breaking news and current events',
  },
  {
    name: 'lifestyle',
    displayName: 'Lifestyle',
    description: 'Health, fashion, and lifestyle tips',
  },
  {
    name: 'health',
    displayName: 'Health',
    description: 'Medical news and health advice',
  },
  {
    name: 'travel',
    displayName: 'Travel',
    description: 'Travel guides and destination reviews',
  },
  {
    name: 'food',
    displayName: 'Food',
    description: 'Recipes, restaurant reviews, and food culture',
  },
  {
    name: 'science',
    displayName: 'Science',
    description: 'Scientific discoveries and research',
  },
  {
    name: 'business',
    displayName: 'Business',
    description: 'Business news and market analysis',
  },
] as const;
