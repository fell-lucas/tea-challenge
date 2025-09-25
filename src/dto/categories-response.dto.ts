import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({
    description: 'Category unique identifier (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  id!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Green Tea',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'All about green tea varieties and brewing techniques',
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'Number of posts in this category',
    example: 156,
    minimum: 0,
  })
  postCount!: number;

  @ApiProperty({
    description: 'Category creation timestamp',
    example: '2025-09-24T10:30:00Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Category last update timestamp',
    example: '2025-09-24T10:30:00Z',
  })
  updatedAt!: string;
}

export class CategoriesResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Array of categories',
    type: [CategoryDto],
  })
  data!: CategoryDto[];
}
