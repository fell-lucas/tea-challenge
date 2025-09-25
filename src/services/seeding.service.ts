import { Injectable, Logger } from '@nestjs/common';
import { PostService } from './post.service';
import { UserService } from './user.service';
import { CategoryService } from './category.service';
import { FeedService } from './feed.service';
import { v7 as uuidv7 } from 'uuid';
import type { CategoryName } from 'src/entities/category.entity';

@Injectable()
export class SeedingService {
  private readonly logger = new Logger(SeedingService.name);

  constructor(
    private postService: PostService,
    private userService: UserService,
    private categoryService: CategoryService,
    private feedService: FeedService,
  ) {}

  async seedAll(totalPosts: number = 5000): Promise<{
    postsCreated: number;
    categoriesCreated: number;
    usersCreated: number;
  }> {
    try {
      await this.clearAllData();

      const categories = await this.categoryService.seedCategories();
      const users = await this.generateUsers(100);
      const posts = await this.generatePosts(
        totalPosts,
        users,
        categories.map((c) => c.name),
      );

      await this.feedService.invalidateCache();

      return {
        postsCreated: posts.length,
        categoriesCreated: categories.length,
        usersCreated: users.length,
      };
    } catch (error) {
      this.logger.error('Error during seeding:', error);
      throw error;
    }
  }

  private async clearAllData(): Promise<void> {
    this.logger.log('Clearing existing data...');
    await Promise.all([
      this.postService.clearAllPosts(),
      this.userService.clearAllUsers(),
      this.categoryService.clearAllCategories(),
    ]);
  }

  private async generateUsers(count: number): Promise<string[]> {
    this.logger.log(`Generating ${count} users...`);
    const userIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const userId = uuidv7();
      await this.userService.findOrCreateUser(userId);
      userIds.push(userId);
    }

    return userIds;
  }

  private async generatePosts(
    count: number,
    userIds: string[],
    categories: CategoryName[],
  ): Promise<any[]> {
    this.logger.log(`Generating ${count} posts...`);
    const posts: any[] = [];

    const titleTemplates = [
      'Breaking: {topic} Changes Everything',
      'Latest {topic} Trends You Need to Know',
      'How {topic} is Revolutionizing the Industry',
      'The Future of {topic}: What Experts Say',
      'Top 10 {topic} Tips for Beginners',
      'Why {topic} Matters More Than Ever',
      'Understanding {topic}: A Complete Guide',
      'The Impact of {topic} on Modern Society',
    ];

    const contentTemplates = [
      'This comprehensive analysis explores the latest developments in {topic}. Recent studies show significant improvements and innovations that are reshaping the landscape.',
      'Industry experts are buzzing about the revolutionary changes in {topic}. These developments promise to transform how we approach traditional methods.',
      'A deep dive into {topic} reveals fascinating insights and practical applications that could benefit millions of people worldwide.',
      'The evolution of {topic} continues to surprise researchers and practitioners alike, with new discoveries emerging regularly.',
      'Understanding the complexities of {topic} requires careful examination of multiple factors and their interconnected relationships.',
    ];

    for (let i = 0; i < count; i++) {
      const category =
        categories[Math.floor(Math.random() * categories.length)];
      const userId = userIds[Math.floor(Math.random() * userIds.length)];

      const title = titleTemplates[
        Math.floor(Math.random() * titleTemplates.length)
      ].replace('{topic}', this.getTopicForCategory(category));

      const content = contentTemplates[
        Math.floor(Math.random() * contentTemplates.length)
      ].replace('{topic}', this.getTopicForCategory(category));

      const tags = this.generateTagsForCategory(category);

      // Create post with random creation time (last 30 days)
      const LAST_30_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;
      const createdAt = new Date(
        Date.now() - Math.random() * LAST_30_DAYS_IN_MS,
      );

      const post = await this.postService.create(
        {
          title,
          content,
          category,
          tags,
          createdAt,
        },
        userId,
      );

      const likeCount = this.generatePowerLawLikes();
      if (likeCount > 0) {
        await this.postService.setLikeCount(post.id.toString(), likeCount);
      }

      posts.push(post);

      if ((i + 1) % 1000 === 0) {
        this.logger.log(`Generated ${i + 1}/${count} posts`);
      }
    }

    return posts;
  }

  private generatePowerLawLikes(): number {
    // Power law distribution: 80% of posts get 0-10 likes, 20% get more
    const random = Math.random();

    if (random < 0.8) {
      // 80% of posts: 0-10 likes
      return Math.floor(Math.random() * 11);
    } else if (random < 0.95) {
      // 15% of posts: 11-100 likes
      return 11 + Math.floor(Math.random() * 90);
    } else {
      // 5% of posts: 101-1000 likes (viral posts)
      return 101 + Math.floor(Math.random() * 900);
    }
  }

  private getTopicForCategory(category: CategoryName): string {
    const topics = {
      technology: 'AI Technology',
      sports: 'Professional Sports',
      entertainment: 'Entertainment Industry',
      news: 'Current Events',
      lifestyle: 'Modern Lifestyle',
      health: 'Health & Wellness',
      travel: 'Travel Destinations',
      food: 'Culinary Arts',
      science: 'Scientific Research',
      business: 'Business Strategy',
    };

    return topics[category] || 'General Topics';
  }

  private generateTagsForCategory(category: CategoryName): string[] {
    const categoryTags = {
      technology: ['tech', 'innovation', 'digital', 'AI', 'software'],
      sports: ['sports', 'athletics', 'competition', 'fitness', 'training'],
      entertainment: [
        'entertainment',
        'movies',
        'music',
        'celebrity',
        'culture',
      ],
      news: ['news', 'current-events', 'politics', 'world', 'breaking'],
      lifestyle: ['lifestyle', 'wellness', 'fashion', 'trends', 'personal'],
      health: ['health', 'medical', 'wellness', 'fitness', 'nutrition'],
      travel: ['travel', 'destinations', 'adventure', 'culture', 'tourism'],
      food: ['food', 'cooking', 'recipes', 'cuisine', 'dining'],
      science: ['science', 'research', 'discovery', 'innovation', 'study'],
      business: ['business', 'strategy', 'finance', 'market', 'economy'],
    } as const;

    const tags = categoryTags[category] || ['general'];
    const numTags = Math.floor(Math.random() * 3) + 1; // 1-3 tags

    return tags.slice(0, numTags);
  }
}
