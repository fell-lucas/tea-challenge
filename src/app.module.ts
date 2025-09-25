import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { OptionalAuthMiddleware } from './middleware/optional-auth.middleware';
import { RequiredAuthMiddleware } from './middleware/required-auth.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';

import { Post, PostSchema } from './entities/post.entity';
import { User, UserSchema } from './entities/user.entity';
import { Category, CategorySchema } from './entities/category.entity';
import {
  UserEngagement,
  UserEngagementSchema,
} from './entities/user-engagement.entity';

import { PostService } from './services/post.service';
import { UserService } from './services/user.service';
import { CategoryService } from './services/category.service';
import { FeedService } from './services/feed.service';
import { CacheService } from './services/cache.service';
import { SeedingService } from './services/seeding.service';
import { EngagementService } from './services/engagement.service';

import { FeedController } from './controllers/feed.controller';
import { PostsController } from './controllers/posts.controller';
import { SeedController } from './controllers/seed.controller';
import { HealthController } from './controllers/health.controller';
import { EngagementController } from './controllers/engagement.controller';
import { CategoriesController } from './controllers/categories.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test'] : ['.env'],
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        retryWrites: true,
        w: 'majority',
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: UserEngagement.name, schema: UserEngagementSchema },
    ]),
  ],
  controllers: [
    HealthController,
    FeedController,
    PostsController,
    SeedController,
    EngagementController,
    CategoriesController,
  ],
  providers: [
    PostService,
    UserService,
    CategoryService,
    FeedService,
    CacheService,
    SeedingService,
    EngagementService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting to GET endpoints (feed, health, categories, post details)
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(
        { path: 'feed', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'categories', method: RequestMethod.GET },
        { path: 'posts/:id', method: RequestMethod.GET },
      );

    // Apply optional authentication to feed endpoint, post details, and categories
    consumer
      .apply(OptionalAuthMiddleware)
      .forRoutes(
        { path: 'feed', method: RequestMethod.GET },
        { path: 'posts/:id', method: RequestMethod.GET },
        { path: 'categories', method: RequestMethod.GET },
      );

    // Apply required authentication to posts endpoint (except seeding) and engagement endpoints
    consumer
      .apply(RequiredAuthMiddleware)
      .forRoutes(
        { path: 'posts', method: RequestMethod.POST },
        { path: 'posts/:id/like', method: RequestMethod.PUT },
        { path: 'posts/:id/dislike', method: RequestMethod.PUT },
      );
  }
}
