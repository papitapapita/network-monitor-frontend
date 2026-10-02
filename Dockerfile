# Dashboard image shared by every customer install. /api is proxied to the
# `backend` service of the same compose project.

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
  NEXT_PUBLIC_API_URL=/api \
  BACKEND_INTERNAL_URL=http://backend:3000 \
  NEXT_STANDALONE=true
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3001
CMD ["node", "server.js"]
