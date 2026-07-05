# syntax=docker/dockerfile:1.7

# ---- Build stage: compile the Vite/React app to static assets ----
FROM node:20-alpine AS build
WORKDIR /app

# Vite bakes these into the bundle at build time (they are public values).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Install deps from the lockfile first so this layer caches across code changes.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage: serve the static build with nginx ----
# Unprivileged nginx image: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

# SPA fallback, gzip, asset caching, security headers.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the built assets (no source, no node_modules).
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

# Base image already runs as non-root and sets this CMD; kept explicit.
CMD ["nginx", "-g", "daemon off;"]
