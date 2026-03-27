# ----------- Stage 1: Build -----------
FROM node:24-alpine AS builder

# Set working directory inside container

WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the source code
COPY . .

# Build the Next.js app
RUN npm run build


# ----------- Stage 2: Production Image -----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Expose Next.js default port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
