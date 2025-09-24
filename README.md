# Tea Challenge Backend

A NestJS-based relevance feed backend API with MongoDB and Redis integration, containerized with Docker Compose.

## 🚀 Features

- **NestJS Framework**: Modern, scalable Node.js server-side applications
- **MongoDB**: Document database for data persistence with schema validation
- **Redis**: In-memory data structure store for caching and ranking (using modern cache-manager v6 with Keyv)
- **Docker Compose**: Multi-container application orchestration
- **TypeScript**: Full TypeScript support with strict type checking
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation
- **Health Checks**: Built-in health monitoring endpoints
- **Environment Configuration**: Flexible environment-based configuration
- **Data Validation**: Request/response validation with class-validator
- **CORS Support**: Cross-origin resource sharing configuration

## 🛠️ Installation & Development Setup

Clone the repository

```bash
git clone <repository-url>
cd tea-challenge
```

Use the automated script:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh start
```

Edit and save files and see the service running in the container restart automatically.

Seed the database with `pnpm re-seed`
Run e2e tests with `pnpm test:e2e`

## 🚀 Production

Use the automated script:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh start:prod
```

Slimmed down production image with only production dependencies, no db/redis management tools, no docs and no hot reload.

## 🔧 Available Services

| Service | Port | Description |
|---------|------|-------------|
| **API** | 3000 | NestJS application |
| **MongoDB** | 27017 | Database server |
| **Redis** | 6379 | Cache server |
| **Mongo Express** | 8081 | Database management UI (only in dev) |
| **Redis Commander** | 8082 | Redis management UI (only in dev) |

## 📚 Swagger API Documentation (only in dev)

Once the application is running, visit:

- **Swagger UI**: http://localhost:3000/docs

