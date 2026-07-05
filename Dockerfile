# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM python:3.12-alpine AS production
RUN addgroup -S app && adduser -S -G app app
COPY --from=build /app/dist /usr/share/app
RUN chown -R app:app /usr/share/app
USER app
WORKDIR /usr/share/app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/', timeout=3)"
CMD ["python3", "-m", "http.server", "8080"]
