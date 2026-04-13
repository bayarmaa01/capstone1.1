# Use Docker Hub with authentication and better caching to avoid rate limiting
FROM docker.io/node:18-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Expose port 3000 for development
EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "start"]


# Build stage - reuse the same base image
FROM docker.io/node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app for production
RUN npm run build


# Production stage - use lightweight nginx alternative
FROM docker.io/nginx:stable-alpine AS production

# Copy built files from build stage to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for production
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]