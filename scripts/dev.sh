#!/bin/bash
# Utility script for common docker-related development tasks

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_color() {
    printf "${1}${2}${NC}\n"
}

show_help() {
    echo "Tea Challenge Backend Docker Helper"
    echo "======================================="
    echo ""
    echo "Usage: ./scripts/dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start development environment"
    echo "  start:prod  Start production environment"
    echo "  logs        Show service logs"
    echo "  clean       Clean up Docker resources"
    echo "  db-seed     Seed database with sample data"
    echo "  db-reset    Reset database"
    echo "  status      Show service status"
    echo "  help        Show this help message"
}

# Check if .env exists
pre_start() {
    if [ ! -f .env ]; then
        print_color $RED "❌ .env file not found. Please create one from .env.example."
        exit 1
    fi
}

start_dev() {
    pre_start
    print_color $GREEN "🧪 Starting development environment..."

    docker compose up -d

    # Follow logs from API container only
    print_color $BLUE "📋 Following API logs (Ctrl+C to stop)..."
    docker compose logs -f api
}

start_prod() {
    pre_start
    print_color $GREEN "🚀 Starting production environment..."
    docker compose -f docker-compose.prod.yml up -d
    print_color $GREEN "✅ Production environment started"
    print_color $BLUE "🚀 Services available at:"
    print_color $BLUE "   • API: http://localhost:3000/api/v1"
    print_color $BLUE "   • Health Check: http://localhost:3000/api/v1/health"
}

show_logs() {
    print_color $BLUE "📋 Showing logs (Ctrl+C to exit)..."
    docker compose logs -f
}

clean_docker() {
    print_color $YELLOW "🧹 Cleaning up tea-challenge Docker resources..."

    print_color $BLUE "🛑 Stopping tea-challenge containers..."
    docker compose down -v 2>/dev/null || true
    docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true

    print_color $BLUE "🗑️  Removing tea-challenge containers..."
    docker ps -a --filter "name=tea-challenge-" --format "{{.Names}}" | while read container; do
        if [ -n "$container" ]; then
            echo "  Removing container: $container"
            docker rm -f "$container" 2>/dev/null || true
        fi
    done

    print_color $BLUE "🖼️  Removing tea-challenge images..."
    docker images --filter "reference=*tea-challenge*" --format "{{.Repository}}:{{.Tag}}" | while read image; do
        if [ -n "$image" ] && [ "$image" != "<none>:<none>" ]; then
            echo "  Removing image: $image"
            docker rmi "$image" 2>/dev/null || true
        fi
    done

    # Remove project service images
    print_color $BLUE "🐳 Removing project service images..."
    project_images="redis:7.2-alpine mongo:7.0 mongo-express:1.0.2 rediscommander/redis-commander:latest"
    for image in $project_images; do
        if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image}$"; then
            echo "  Removing service image: $image"
            docker rmi "$image" 2>/dev/null || true
        fi
    done

    print_color $BLUE "💾 Removing tea-challenge volumes..."
    for volume in "tea-challenge_mongodb_data" "tea-challenge_mongodb_config" "tea-challenge_redis_data" "tea-challenge_mongodb_data_prod" "tea-challenge_mongodb_config_prod" "tea-challenge_redis_data_prod"; do
        if docker volume ls -q | grep -q "^${volume}$"; then
            echo "  Removing volume: $volume"
            docker volume rm "$volume" 2>/dev/null || true
        fi
    done

    print_color $BLUE "🌐 Removing tea-challenge network..."
    if docker network ls --filter "name=tea-challenge-network" --format "{{.Name}}" | grep -q "tea-challenge-network"; then
        echo "  Removing network: tea-challenge-network"
        docker network rm tea-challenge-network 2>/dev/null || true
    fi

    print_color $BLUE "🧽 Removing dangling images..."
    dangling_images=$(docker images -f "dangling=true" -q)
    if [ -n "$dangling_images" ]; then
        echo "  Removing dangling images..."
        docker rmi $dangling_images 2>/dev/null || true
    fi

    print_color $GREEN "✅ Tea-challenge Docker resources cleaned"
    print_color $YELLOW "ℹ️  Other Docker projects were left untouched"
}

seed_database() {
    print_color $BLUE "🌱 Seeding database..."
    docker compose restart mongodb
    print_color $GREEN "✅ Database seeded"
}

reset_database() {
    print_color $YELLOW "🗑️  Resetting database..."
    docker compose down mongodb
    docker volume rm tea-challenge_mongodb_data 2>/dev/null || true
    docker volume rm tea-challenge_mongodb_config 2>/dev/null || true
    docker compose up -d mongodb
    print_color $GREEN "✅ Database reset"
}

show_status() {
    print_color $BLUE "📊 Service Status:"
    docker compose ps
}

main() {
    case "${1:-help}" in
        start)
            start_dev
            ;;
        start:prod)
            start_prod
            ;;
        logs)
            show_logs
            ;;
        clean)
            clean_docker
            ;;
        db-seed)
            seed_database
            ;;
        db-reset)
            reset_database
            ;;
        status)
            show_status
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"
