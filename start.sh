#!/bin/bash

echo "==================================="
echo "Webook Ticket Bot Starter"
echo "==================================="
echo

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in your PATH."
    echo "Please install Node.js from https://nodejs.org/"
    echo
    read -p "Press Enter to continue..."
    exit 1
fi

# Check for required files
if [ ! -f "src/index.js" ]; then
    echo "ERROR: Required files are missing. Please make sure you're in the correct directory."
    echo
    read -p "Press Enter to continue..."
    exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "WARNING: No .env file found."
    echo "The web interface will start, but you'll need to configure your settings there."
    echo
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies."
        echo
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

echo "Starting Webook Ticket Bot..."
echo
echo "Access the web interface at: http://localhost:3000"
echo
echo "Press Ctrl+C to stop the bot."
echo

# Start the bot
node src/index.js 