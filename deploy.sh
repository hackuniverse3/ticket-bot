#!/bin/bash

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "fly CLI is not installed. Please install it first."
    echo "Visit: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if user is logged in
fly auth whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "You are not logged in to fly.io. Please login first."
    fly auth login
fi

# Deploy the app
echo "Deploying the football ticket bot to fly.io..."
fly deploy

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "Deployment successful! Your app is now running on fly.io."
    fly status
    echo ""
    echo "You can check the logs with: fly logs"
    echo "You can open the app with: fly open"
else
    echo "Deployment failed. Please check the error message above."
fi 