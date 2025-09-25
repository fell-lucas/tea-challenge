import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserEngagementDocument = UserEngagement & Document;

export enum EngagementType {
  LIKE = 'like',
  DISLIKE = 'dislike',
}

@Schema({
  timestamps: true,
  collection: 'user_engagements',
})
export class UserEngagement {
  @Prop({
    required: true,
    match:
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  })
  userId!: string; // UUID v7 format

  @Prop({
    required: true,
    type: String,
  })
  postId!: string; // MongoDB ObjectId

  @Prop({
    required: true,
    enum: Object.values(EngagementType),
    type: String,
  })
  engagementType!: EngagementType;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserEngagementSchema =
  SchemaFactory.createForClass(UserEngagement);

// Unique constraint: one engagement per user per post
UserEngagementSchema.index({ userId: 1, postId: 1 }, { unique: true });

// Secondary index for aggregation queries
UserEngagementSchema.index({ postId: 1, engagementType: 1 });
