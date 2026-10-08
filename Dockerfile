FROM oven/bun:1-alpine AS builder

WORKDIR /app

ARG SITE_URL
ARG API_URL

COPY package.json bun.lock ./

ENV VITE_PUBLIC_SITE_URL=$SITE_URL
ENV VITE_MDOC_API_URL=$API_URL

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM nginx:alpine AS runner

ARG VERSION
ARG BUILD_TIME

COPY ./nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/dist /usr/share/nginx/html

COPY ./docker/runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

ENV NODE_ENV=production
ENV VUE_APP_VERSION=$VERSION
ENV VUE_APP_BUILD_TIME=$BUILD_TIME

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]