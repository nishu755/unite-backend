
#!/bin/bash

echo "🔍 Docker Troubleshooting Tool"
echo "=============================="
echo ""

# Check if docker-compose is running
if docker-compose ps 2>/dev/null | grep -q "unite-backend"; then
    COMPOSE_FILE="docker-compose.yml"
    echo "✅ Found running services (docker-compose.yml)"
elif docker-compose -f docker-compose.dev.yml ps 2>/dev/null | grep -q "unite-backend"; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "✅ Found running services (docker-compose.dev.yml)"
else
    echo "❌ No running services found"
    echo ""
    echo "Start services with:"
    echo "  ./complete-setup.sh"
    exit 1
fi

echo ""

# Function to run compose commands
run_compose() {
    if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
        docker-compose -f docker-compose.dev.yml "$@"
    else
        docker-compose "$@"
    fi
}

# Check 1: Container Status
echo "📦 Container Status:"
run_compose ps
echo ""

# Check 2: App Container Logs (last 30 lines)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 App Container Logs (last 30 lines):"
echo ""
run_compose logs --tail=30 app
echo ""

# Check 3: App Container Health
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 App Container Health:"
CONTAINER_ID=$(docker ps -q -f name=unite-backend)
if [ -n "$CONTAINER_ID" ]; then
    echo "Container ID: $CONTAINER_ID"
    echo "Container Status: $(docker inspect -f '{{.State.Status}}' $CONTAINER_ID)"
    echo ""
    
    # Check files in container
    echo "📁 Files in /app:"
    docker exec $CONTAINER_ID ls -la /app 2>/dev/null || echo "Cannot access container"
    echo ""
    
    echo "📁 Files in /app/src:"
    docker exec $CONTAINER_ID ls -la /app/src 2>/dev/null || echo "No src directory"
    echo ""
    
    echo "📁 Files in /app/dist:"
    docker exec $CONTAINER_ID ls -la /app/dist 2>/dev/null || echo "No dist directory"
    echo ""
    
    # Check node processes
    echo "🔍 Node processes:"
    docker exec $CONTAINER_ID ps aux 2>/dev/null | grep node || echo "No node process running"
else
    echo "❌ App container not running"
fi
echo ""

# Check 4: Database Connections
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  Database Status:"
echo ""

# MySQL
echo "MySQL:"
run_compose exec mysql mysqladmin ping -u root -proot_password 2>/dev/null && echo "  ✅ MySQL is UP" || echo "  ❌ MySQL is DOWN"

# MongoDB
echo "MongoDB:"
run_compose exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null && echo "  ✅ MongoDB is UP" || echo "  ❌ MongoDB is DOWN"

# Redis
echo "Redis:"
run_compose exec redis redis-cli -a redis_password ping 2>/dev/null && echo "  ✅ Redis is UP" || echo "  ❌ Redis is DOWN"

echo ""

# Check 5: Network
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Network Connectivity:"
echo ""

# Test API endpoint
echo "Testing http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ]; then
    echo "  ✅ API is responding (HTTP $RESPONSE)"
elif [ "$RESPONSE" = "000" ]; then
    echo "  ❌ Cannot connect to API"
else
    echo "  ⚠️  API returned HTTP $RESPONSE"
fi
echo ""

# Check 6: Port Conflicts
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 Port Usage:"
echo ""
echo "Port 3000 (App):"
lsof -i :3000 2>/dev/null | grep LISTEN || echo "  ℹ️  Port 3000 is free"
echo ""
echo "Port 3306 (MySQL):"
lsof -i :3306 2>/dev/null | grep LISTEN || echo "  ℹ️  Port 3306 is free"
echo ""
echo "Port 27017 (MongoDB):"
lsof -i :27017 2>/dev/null | grep LISTEN || echo "  ℹ️  Port 27017 is free"
echo ""

# Suggestions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Common Fixes:"
echo ""
echo "1. Restart all services:"
echo "   run_compose restart"
echo ""
echo "2. View live logs:"
echo "   run_compose logs -f app"
echo ""
echo "3. Rebuild from scratch:"
echo "   run_compose down -v && run_compose up --build -d"
echo ""
echo "4. Check app container shell:"
echo "   run_compose exec app sh"
echo ""
echo "5. Check environment variables:"
echo "   run_compose exec app env | grep -E 'DB_|MONGO|REDIS'"
echo ""