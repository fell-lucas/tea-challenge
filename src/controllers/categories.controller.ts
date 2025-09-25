import { Controller, Get, Logger, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CategoryService } from '../services/category.service';
import {
  CategoriesResponseDto,
  CategoryDto,
} from '../dto/categories-response.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all categories',
    description:
      'Retrieve all available categories ordered by popularity (open access)',
  })
  @ApiHeader({
    name: 'X-User-Id',
    description: 'Optional user ID (does not affect response)',
    required: false,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    type: CategoriesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Bad request (invalid X-User-Id format when provided)',
  })
  async getAllCategories(@Req() req: Request): Promise<CategoriesResponseDto> {
    try {
      const userId = req.userId; // Set by OptionalAuthMiddleware (may be undefined)
      this.logger.log(
        `Getting all categories${userId ? ` (user: ${userId})` : ' (anonymous)'}`,
      );

      const categories = await this.categoryService.findAllByPopularity();

      const categoryDtos: CategoryDto[] = categories.map((category) => ({
        id: String(category._id),
        name: category.name,
        description: category.description,
        postCount: category.postCount,
        createdAt: category.createdAt!.toISOString(),
        updatedAt: category.updatedAt!.toISOString(),
      }));

      this.logger.log(
        `Retrieved ${categoryDtos.length} categories ordered by popularity`,
      );

      return {
        success: true,
        data: categoryDtos,
      };
    } catch (error) {
      this.logger.error('Error getting categories:', error);
      throw error;
    }
  }
}
