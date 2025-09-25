import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { CategoryName } from './category.entity';

export type PostDocument = Post & Document<string>;

@Schema({
  timestamps: true,
  collection: 'posts',
})
export class Post {
  @Prop({ required: true, maxlength: 200, trim: true })
  title!: string;

  @Prop({ required: true, maxlength: 5000, trim: true })
  content!: string;

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
  category!: CategoryName;

  @Prop({
    required: true,
    match:
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  })
  userId!: string; // UUID v7 format

  @Prop({ default: 0, min: 0 })
  likeCount!: number;

  @Prop({ default: 0, min: 0 })
  dislikeCount!: number;

  @Prop({ default: () => new Date() })
  engagementUpdatedAt!: Date;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;

  // Virtual field for relevance score calculation
  get relevanceScore(): number {
    if (!this.createdAt) return 0;

    const hoursOld = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
    const decayFactor = Math.exp(-0.1 * hoursOld);
    return this.likeCount * decayFactor;
  }
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ category: 1, createdAt: -1, likeCount: -1 });
PostSchema.index({ createdAt: -1, likeCount: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ isActive: 1 });
PostSchema.index({ _id: 1, likeCount: -1, dislikeCount: -1 });

// Add virtual for relevance score
PostSchema.virtual('relevanceScore').get(function () {
  const hoursOld = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  const decayFactor = Math.exp(-0.1 * hoursOld);
  return this.likeCount * decayFactor;
});

// Ensure virtual fields are serialized
PostSchema.set('toJSON', { virtuals: true });
PostSchema.set('toObject', { virtuals: true });
