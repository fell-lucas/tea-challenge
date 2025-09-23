// MongoDB Initialization Script for Tea Challenge Backend
// This script runs when MongoDB container starts for the first time

// Switch to the tea-challenge database
db = db.getSiblingDB('tea-challenge');

// Create collections with initial schema validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'must be a valid email address'
        },
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 50,
          description: 'must be a string between 3-50 characters'
        },
        createdAt: {
          bsonType: 'date',
          description: 'must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'must be a date'
        }
      }
    }
  }
});

db.createCollection('posts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'content', 'authorId', 'createdAt'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'must be a string between 1-200 characters'
        },
        content: {
          bsonType: 'string',
          minLength: 1,
          description: 'must be a non-empty string'
        },
        authorId: {
          bsonType: 'objectId',
          description: 'must be a valid ObjectId'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'must be an array of strings'
        },
        relevanceScore: {
          bsonType: 'number',
          minimum: 0,
          maximum: 100,
          description: 'must be a number between 0-100'
        },
        createdAt: {
          bsonType: 'date',
          description: 'must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'must be a date'
        }
      }
    }
  }
});

db.createCollection('interactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'postId', 'type', 'createdAt'],
      properties: {
        userId: {
          bsonType: 'objectId',
          description: 'must be a valid ObjectId'
        },
        postId: {
          bsonType: 'objectId',
          description: 'must be a valid ObjectId'
        },
        type: {
          bsonType: 'string',
          enum: ['view', 'like', 'share', 'comment'],
          description: 'must be one of: view, like, share, comment'
        },
        value: {
          bsonType: 'number',
          description: 'interaction weight/value'
        },
        createdAt: {
          bsonType: 'date',
          description: 'must be a date'
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true, sparse: true });
db.users.createIndex({ createdAt: -1 });

db.posts.createIndex({ authorId: 1 });
db.posts.createIndex({ createdAt: -1 });
db.posts.createIndex({ relevanceScore: -1 });
db.posts.createIndex({ tags: 1 });
db.posts.createIndex({ title: 'text', content: 'text' });

db.interactions.createIndex({ userId: 1, postId: 1 });
db.interactions.createIndex({ postId: 1 });
db.interactions.createIndex({ type: 1 });
db.interactions.createIndex({ createdAt: -1 });

// Insert sample data for development
const sampleUsers = [
  {
    email: 'john.doe@example.com',
    username: 'johndoe',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    email: 'jane.smith@example.com',
    username: 'janesmith',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const insertedUsers = db.users.insertMany(sampleUsers);
const userIds = Object.values(insertedUsers.insertedIds);

const samplePosts = [
  {
    title: 'Welcome to Tea Challenge Backend',
    content: 'This is a sample post to demonstrate the relevance feed functionality.',
    authorId: userIds[0],
    tags: ['welcome', 'demo', 'backend'],
    relevanceScore: 85,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    title: 'Building Scalable APIs with NestJS',
    content: 'Learn how to build robust and scalable APIs using NestJS framework with MongoDB and Redis.',
    authorId: userIds[1],
    tags: ['nestjs', 'api', 'mongodb', 'redis'],
    relevanceScore: 92,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const insertedPosts = db.posts.insertMany(samplePosts);
const postIds = Object.values(insertedPosts.insertedIds);

// Sample interactions
const sampleInteractions = [
  {
    userId: userIds[0],
    postId: postIds[1],
    type: 'view',
    value: 1,
    createdAt: new Date()
  },
  {
    userId: userIds[1],
    postId: postIds[0],
    type: 'like',
    value: 2,
    createdAt: new Date()
  }
];

db.interactions.insertMany(sampleInteractions);

print('MongoDB initialization completed successfully!');
print('Created collections: users, posts, interactions');
print('Inserted sample data for development');
print('Created indexes for optimal performance');
