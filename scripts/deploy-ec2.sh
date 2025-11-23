#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
EC2_INSTANCE_ID=${EC2_INSTANCE_ID}
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPOSITORY=${ECR_REPOSITORY:-unite-backend}
DOCKER_PORT=${DOCKER_PORT:-3000}
HEALTH_CHECK_URL=${HEALTH_CHECK_URL:-http://localhost:3000/health}

echo -e "${YELLOW}[Deploy] Starting deployment to $ENVIRONMENT EC2 instance...${NC}"

# Validate inputs
if [ -z "$EC2_INSTANCE_ID" ]; then
    echo -e "${RED}[Error] EC2_INSTANCE_ID not set${NC}"
    exit 1
fi

# Get EC2 instance details
echo -e "${YELLOW}[Deploy] Getting EC2 instance details...${NC}"
INSTANCE_INFO=$(aws ec2 describe-instances \
    --region $AWS_REGION \
    --instance-ids $EC2_INSTANCE_ID \
    --query 'Reservations[0].Instances[0]')

PUBLIC_IP=$(echo $INSTANCE_INFO | jq -r '.PublicIpAddress')
PRIVATE_IP=$(echo $INSTANCE_INFO | jq -r '.PrivateIpAddress')

if [ "$PUBLIC_IP" == "null" ] || [ -z "$PUBLIC_IP" ]; then
    echo -e "${RED}[Error] Could not retrieve EC2 instance IP${NC}"
    exit 1
fi

echo -e "${GREEN}[Deploy] EC2 Instance: $EC2_INSTANCE_ID${NC}"
echo -e "${GREEN}[Deploy] Public IP: $PUBLIC_IP${NC}"
echo -e "${GREEN}[Deploy] Private IP: $PRIVATE_IP${NC}"

# Get latest image from ECR
echo -e "${YELLOW}[Deploy] Getting latest Docker image from ECR...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"

# Create deployment command
DEPLOY_COMMAND="
set -e

echo 'Logging in to ECR...'
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo 'Pulling latest image...'
docker pull $ECR_IMAGE_URI

echo 'Stopping existing container...'
docker stop unite-backend || true
docker rm unite-backend || true

echo 'Starting new container...'
docker run -d \
    --name unite-backend \
    --restart unless-stopped \
    -p $DOCKER_PORT:3000 \
    --env-file /opt/unite/.env \
    --log-driver awslogs \
    --log-opt awslogs-group=/aws/ec2/unite-backend \
    --log-opt awslogs-region=$AWS_REGION \
    $ECR_IMAGE_URI

echo 'Waiting for service to be ready...'
for i in {1..30}; do
    if curl -f $HEALTH_CHECK_URL > /dev/null 2>&1; then
        echo 'Service is healthy'
        exit 0
    fi
    echo 'Waiting... ('$i'/30)'
    sleep 2
done

echo 'Health check failed'
exit 1
"

# Execute deployment command on EC2 instance via Systems Manager
echo -e "${YELLOW}[Deploy] Executing deployment command on EC2 instance...${NC}"

COMMAND_ID=$(aws ssm send-command \
    --region $AWS_REGION \
    --document-name "AWS-RunShellScript" \
    --instance-ids $EC2_INSTANCE_ID \
    --parameters "commands='$DEPLOY_COMMAND'" \
    --output text \
    --query 'Command.CommandId')

echo -e "${GREEN}[Deploy] Command ID: $COMMAND_ID${NC}"

# Wait for command to complete
echo -e "${YELLOW}[Deploy] Waiting for deployment to complete...${NC}"
aws ssm get-command-invocation \
    --region $AWS_REGION \
    --command-id $COMMAND_ID \
    --instance-id $EC2_INSTANCE_ID \
    --query 'Status' \
    --output text

# Check command status
STATUS=$(aws ssm get-command-invocation \
    --region $AWS_REGION \
    --command-id $COMMAND_ID \
    --instance-id $EC2_INSTANCE_ID \
    --query 'Status' \
    --output text)

if [ "$STATUS" == "Success" ]; then
    echo -e "${GREEN}[Deploy] Deployment successful!${NC}"
    echo -e "${GREEN}[Deploy] Application URL: http://$PUBLIC_IP:$DOCKER_PORT${NC}"
    
    # Run smoke tests
    echo -e "${YELLOW}[Deploy] Running smoke tests...${NC}"
    sleep 5
    
    if curl -f http://$PUBLIC_IP:$DOCKER_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}[Deploy] Smoke tests passed${NC}"
        exit 0
    else
        echo -e "${RED}[Deploy] Smoke tests failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}[Deploy] Deployment failed with status: $STATUS${NC}"
    
    # Get error output
    ERROR_OUTPUT=$(aws ssm get-command-invocation \
        --region $AWS_REGION \
        --command-id $COMMAND_ID \
        --instance-id $EC2_INSTANCE_ID \
        --query 'StandardErrorContent' \
        --output text)
    
    echo -e "${RED}[Deploy] Error Output:${NC}"
    echo "$ERROR_OUTPUT"
    exit 1
fi