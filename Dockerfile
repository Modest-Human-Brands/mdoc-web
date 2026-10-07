FROM oven/bun:1-alpine AS builder

WORKDIR /app

ARG SITE_URL
ARG VITE_API_BASE_URL

COPY package.json bun.lock ./

ENV VITE_SITE_URL=$SITE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM nginx:alpine AS runner

ARG VERSION
ARG BUILD_TIME

# Custom Nginx configuration (must be configured to listen on port 8080)
COPY ./nginx.conf /etc/nginx/nginx.conf

# Copy built static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

ENV NODE_ENV=production
ENV VUE_APP_VERSION=$VERSION
ENV VUE_APP_BUILD_TIME=$BUILD_TIME

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]