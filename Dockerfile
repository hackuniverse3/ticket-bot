FROM node:18-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Create log directory
RUN mkdir -p logs

# Expose the port the app runs on
EXPOSE 8080

# Run the application
CMD ["node", "src/index.js"] 