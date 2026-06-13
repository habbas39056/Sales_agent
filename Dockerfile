# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package.json and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy the rest of the frontend source and build it
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend and serve the full application
FROM node:20-alpine
WORKDIR /app/backend

# Copy backend dependencies and install
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Copy built frontend from Stage 1
# We put it in /app/frontend/dist because backend/index.js looks at '../frontend/dist'
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Ensure the uploads directory exists
RUN mkdir -p uploads

# Expose port 5000 (which is the default PORT in index.js)
EXPOSE 5000

# Start server
CMD ["node", "index.js"]
