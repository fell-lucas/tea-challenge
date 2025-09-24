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

import { PostService } from './services/post.service';
import { UserService } from './services/user.service';
import { CategoryService } from './services/category.service';
import { FeedService } from './services/feed.service';
import { CacheService } from './services/cache.service';
import { SeedingService } from './services/seeding.service';

import { FeedController } from './controllers/feed.controller';
import { PostsController } from './controllers/posts.controller';
import { SeedController } from './controllers/seed.controller';
import { HealthController } from './controllers/health.controller';

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
    ]),
  ],
  controllers: [
    HealthController,
    FeedController,
    PostsController,
    SeedController,
  ],
  providers: [
    PostService,
    UserService,
    CategoryService,
    FeedService,
    CacheService,
    SeedingService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting to GET endpoints (feed and health)
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(
        { path: 'feed', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
      );

    // Apply optional authentication to feed endpoint
    consumer
      .apply(OptionalAuthMiddleware)
      .forRoutes({ path: 'feed', method: RequestMethod.GET });

    // Apply required authentication to posts endpoint (except seeding)
    consumer.apply(RequiredAuthMiddleware).forRoutes('posts');
  }
}
