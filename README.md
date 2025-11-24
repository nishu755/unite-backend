# Unite Backend - Production-Ready API

A production-ready Node.js + TypeScript backend system with comprehensive features including RBAC authentication, lead management, call task management, CSV import, real-time notifications, and advanced DevOps practices.

## 🚀 Features

### Core Functionality
- ✅ **JWT Authentication** with refresh tokens
- ✅ **Role-Based Access Control** (Admin, Manager, Agent)
- ✅ **Lead Management** with CRUD operations
- ✅ **Call Task Management** with idempotency
- ✅ **CSV Import** with async processing
- ✅ **Real-time Reporting** and analytics
- ✅ **Image Upload** via S3 pre-signed URLs
- ✅ **SMS Notifications** via Twilio
- ✅ **SNS Notifications** for task events

### Infrastructure
- ✅ **MySQL** for relational data
- ✅ **MongoDB** for logs and metadata
- ✅ **Redis** for caching and rate limiting
- ✅ **AWS S3** for file storage
- ✅ **AWS SNS** for notifications
- ✅ **AWS SQS** for async job processing
- ✅ **Docker** containerization
- ✅ **CI/CD** via GitHub Actions & AWS CodePipeline

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Docker Deployment](#docker-deployment)
- [AWS Deployment](#aws-deployment)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Architecture](#architecture)
- [Monitoring](#monitoring)

## 📦 Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Docker & Docker Compose
- MySQL 8.0+
- MongoDB 6.0+
- Redis 7.x
- AWS Account (for S3, SNS, SQS, EC2)
- Twilio Account (for SMS)

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/unite-backend.git
cd unite-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Initialize databases
```bash
# Run MySQL initialization script
mysql -u root -p < src/script/init-mysql.sql

# MongoDB will auto-initialize on first connection
```

### 5. Build TypeScript
```bash
npm run build
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=unite
DB_PASSWORD=your_password
DB_NAME=unite_db

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=unite_logs

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_IMAGES=unite-images
S3_BUCKET_CSV=unite-csv
SNS_TOPIC_ARN=arn:aws:sns:region:account:topic
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/queue

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Run Worker (for CSV processing)
```bash
npm run start:worker
```

## 🐳 Docker Deployment

### Build and run with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down
```

### Build individual Docker image
```bash
docker build -t unite-backend .
docker run -p 3000:3000 --env-file .env unite-backend
```

## ☁️ AWS Deployment

### EC2 Deployment

1. **Launch EC2 Instance**
```bash
# Use Ubuntu 22.04 LTS
# Instance type: t3.medium or larger
# Security groups: Allow ports 22, 80, 443, 3000
```

2. **SSH into EC2 and setup**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository
git clone https://github.com/yourusername/unite-backend.git
cd unite-backend

# Setup environment
cp .env.example .env
nano .env  # Edit with your values

# Start services
docker-compose up -d
```

### AWS CodePipeline Setup

1. Create CodePipeline in AWS Console
2. Connect to GitHub repository
3. Use `buildspec.yml` for CodeBuild
4. Deploy to ECS or EC2

### DigitalOcean Deployment

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Clone and setup (same as EC2 steps above)
```

## 📚 API Documentation

### Base URL
```
Production: https://api.yourdom ain.com
Development: http://localhost:3000
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "agent",
  "phone": "+1234567890"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Lead Endpoints

#### Create Lead
```http
POST /api/leads
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "source": "website",
  "assigned_to": 1
}
```

#### Get All Leads
```http
GET /api/leads?status=new&page=1&limit=20
Authorization: Bearer {token}
```

### Call Task Endpoints

#### Create Call Task
```http
POST /api/call-tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "lead_id": 1,
  "agent_id": 2,
  "scheduled_at": "2024-12-01T10:00:00Z"
}
```

#### Complete Call Task
```http
POST /api/call-tasks/:id/complete
Authorization: Bearer {token}
Content-Type: application/json

{
  "notes": "Successfully contacted the lead",
  "outcome": "Interested in product demo"
}
```

### CSV Upload
```http
POST /api/csv/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: leads.csv
```

### Reports
```http
GET /api/reports/daily-summary?date=2024-11-24
Authorization: Bearer {token}
```

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run with coverage
```bash
npm run test:coverage
```

### Load Testing
```bash
# Install k6
brew install k6  # macOS
# or
sudo apt install k6  # Linux

# Run load tests
npm run load-test
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically:
1. ✅ Lints code with ESLint
2. ✅ Runs TypeScript type checking
3. ✅ Executes unit and integration tests
4. ✅ Builds Docker images
5. ✅ Pushes to container registry
6. ✅ Deploys to EC2 and DigitalOcean
7. ✅ Triggers AWS CodePipeline
8. ✅ Runs load tests
9. ✅ Sends Slack notifications

### Required GitHub Secrets

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
EC2_HOST
EC2_USERNAME
EC2_SSH_KEY
DO_HOST
DO_USERNAME
DO_SSH_KEY
SLACK_WEBHOOK
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Applications                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer (ALB)                   │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                   ▼
   ┌────────┐        ┌────────┐         ┌────────┐
   │  API   │        │  API   │         │  API   │
   │Instance│        │Instance│         │Instance│
   └────────┘        └────────┘         └────────┘
        │                  │                   │
        └──────────────────┼───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                   ▼
   ┌────────┐        ┌─────────┐        ┌────────┐
   │  MySQL │        │ MongoDB │        │ Redis  │
   └────────┘        └─────────┘        └────────┘
        │                  │                   │
        └──────────────────┼───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                   ▼
   ┌────────┐        ┌─────────┐        ┌────────┐
   │   S3   │        │   SNS   │        │  SQS   │
   └────────┘        └─────────┘        └────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ CSV Worker  │
                    └─────────────┘
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Logs
```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# Docker logs
docker-compose logs -f api
```

### Sentry Integration
Error tracking is automatically enabled in production with Sentry DSN configured.

## 🔐 Security Features

- ✅ Helmet.js for HTTP headers security
- ✅ CORS configuration
- ✅ Rate limiting with Redis
- ✅ JWT token authentication
- ✅ Password hashing with bcrypt
- ✅ Input validation with Joi
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Environment variable secrets

## 📈 Performance Optimization

- ✅ Redis caching layer
- ✅ Database connection pooling
- ✅ Compression middleware
- ✅ Async job processing
- ✅ Circuit breaker pattern for external services
- ✅ Retry mechanisms with exponential backoff

## 📝 License

This project is licensed under the MIT License.

## 👥 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For support, email nishantjambhulkar6@gmail.co or create an issue in the repository.

## 🙏 Acknowledgments
- Open source contributors