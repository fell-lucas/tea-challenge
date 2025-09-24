import {
  IsString,
  IsNotEmpty,
  Length,
  IsIn,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { CategoryName } from 'src/entities/category.entity';

export class CreatePostDto {
  @ApiProperty({
    description: 'Post title',
    minLength: 1,
    maxLength: 200,
    example: 'Latest AI Breakthrough in Machine Learning',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  title!: string;

  @ApiProperty({
    description: 'Post content',
    minLength: 1,
    maxLength: 5000,
    example:
      'Scientists have developed a new neural network architecture that significantly improves performance on natural language tasks.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 5000)
  content!: string;

  @ApiProperty({
    description: 'Post category',
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
    example: 'technology',
  })
  @IsString()
  @IsIn([
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
  ])
  category!: CategoryName;

  @ApiProperty({
    description: 'Optional post tags',
    type: [String],
    required: false,
    example: ['AI', 'machine-learning', 'research'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Include createdAt for seeding purposes (not exposed in API)
  @IsOptional()
  @IsNotEmpty()
  createdAt?: Date;
}
