#!/bin/bash

set -e

echo "🚀 Unite Backend - Complete Docker Setup"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check project structure
echo "📋 Checking project structure..."
echo ""

if [ -f "package.json" ]; then
    echo "✅ package.json found"
else
    echo -e "${RED}❌ package.json not found!${NC}"
    exit 1
fi

# Check for TypeScript
if [ -f "tsconfig.json" ]; then
    echo "✅ TypeScript project detected (tsconfig.json found)"
    PROJECT_TYPE="typescript"
else
    echo "ℹ️  JavaScript project (no tsconfig.json)"
    PROJECT_TYPE="javascript"
fi

# Check src directory
if [ -d "src" ]; then
    echo "✅ src directory found"
    echo "   Files in src/:"
    ls -1 src/ | head -5
    
    # Check for entry point
    if [ -f "src/index.js" ] || [ -f "src/index.ts" ]; then
        echo "✅ Entry point: src/index.*"
        ENTRY_POINT="index"
    elif [ -f "src/server.js" ] || [ -f "src/server.ts" ]; then
        echo "✅ Entry point: src/server.*"
        ENTRY_POINT="server"
    elif [ -f "src/app.js" ] || [ -f "src/app.ts" ]; then
        echo "✅ Entry point: src/app.*"
        ENTRY_POINT="app"
    else
        echo -e "${YELLOW}⚠️  Could not determine entry point${NC}"
        ENTRY_POINT="unknown"
    fi
else
    echo -e "${RED}❌ src directory not found!${NC}"
    exit 1
fi

echo ""
echo "📦 Package.json scripts:"
cat package.json | grep -A 10 '"scripts"' | head -12

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 2: Ask user for setup mode
echo "Choose setup mode:"
echo ""
echo "1) 🔧 Development Mode (Recommended)"
echo "   - Hot reload enabled"
echo "   - Source code mounted"
echo "   - Easy debugging"
echo "   - Faster iteration"
echo ""
echo "2) 🏭 Production Mode"
echo "   - Built Docker image"
echo "   - Optimized for deployment"
echo "   - No hot reload"
echo ""
read -p "Enter choice [1-2] (default: 1): " choice
choice=${choice:-1}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 3: Clean up existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down -v 2>/dev/null || true
docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
echo "✅ Cleanup complete"
echo ""

# Step 4: Start services based on choice
if [ "$choice" = "2" ]; then
    echo "🏭 Starting in PRODUCTION mode..."
    echo ""
    
    # Build
    echo "🔨 Building Docker image (this may take a few minutes)..."
    if docker-compose build app 2>&1 | tee /tmp/docker-build.log; then
        echo -e "${GREEN}✅ Build successful${NC}"
    else
        echo -e "${RED}❌ Build failed. Check logs above.${NC}"
        echo ""
        echo "Common issues:"
        echo "  - Missing dependencies in package.json"
        echo "  - Build script errors"
        echo "  - Try development mode instead (option 1)"
        exit 1
    fi
    
    echo ""
    echo "🚀 Starting all services..."
    docker-compose up -d
    
    COMPOSE_FILE="docker-compose.yml"
    SERVICE_NAME="app"
else
    echo "🔧 Starting in DEVELOPMENT mode..."
    echo ""
    echo "🚀 Starting all services..."
    
    if [ -f "docker-compose.dev.yml" ]; then
        docker-compose -f docker-compose.dev.yml up -d
        COMPOSE_FILE="docker-compose.dev.yml"
    else
        echo -e "${YELLOW}⚠️  docker-compose.dev.yml not found, using regular compose${NC}"
        docker-compose up -d
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    SERVICE_NAME="app"
fi

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Step 5: Show service status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Status:"
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml ps
else
    docker-compose ps
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 6: Show logs
echo "📝 Recent logs from app service:"
echo ""
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml logs --tail=50 app
else
    docker-compose logs --tail=50 app
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "📍 Service URLs:"
echo "   🌐 API:     http://localhost:3000"
echo "   🗄️  MySQL:   localhost:3306"
echo "   🍃 MongoDB: localhost:27017"
echo "   🔴 Redis:   localhost:6379"
echo ""
echo "📝 Useful Commands:"
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    echo "   View logs:          docker-compose -f docker-compose.dev.yml logs -f app"
    echo "   Stop services:      docker-compose -f docker-compose.dev.yml down"
    echo "   Restart app:        docker-compose -f docker-compose.dev.yml restart app"
    echo "   Shell into app:     docker-compose -f docker-compose.dev.yml exec app sh"
else
    echo "   View logs:          docker-compose logs -f app"
    echo "   Stop services:      docker-compose down"
    echo "   Restart app:        docker-compose restart app"
    echo "   Shell into app:     docker-compose exec app sh"
fi
echo ""
echo "🔍 Test the API:"
echo "   curl http://localhost:3000/health"
echo ""