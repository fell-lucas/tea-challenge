import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({
    required: true,
    match:
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  })
  userId!: string; // UUID v7 format

  @Prop({ default: Date.now })
  lastSeenAt!: Date;

  @Prop({ default: 0, min: 0 })
  postCount!: number;

  @Prop({ default: true })
  isActive!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ userId: 1 }, { unique: true });
UserSchema.index({ lastSeenAt: -1 });
UserSchema.index({ isActive: 1 });
