FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
ARG SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$SITE_URL
ENV API_INTERNAL_URL=http://api:4000
RUN npm run build

FROM build AS api
ENV NODE_ENV=production PORT=4000 AUTO_SEED=false UPLOAD_DIR=/app/backend/uploads
RUN mkdir -p /app/backend/uploads && chown -R node:node /app/backend/uploads
USER node
EXPOSE 4000
CMD ["npm", "run", "start:backend"]

FROM node:24-bookworm-slim AS web
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 API_INTERNAL_URL=http://api:4000
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
