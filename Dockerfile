# syntax=docker/dockerfile:1
#
# Single image that can run as either the Vite dev server (with HMR) or a
# production build served by nginx. Which one runs is decided at container
# *start* time by docker-entrypoint.sh, based on the APP_ENV value found in
# .env (see README.md "Configuration"). This keeps one Dockerfile/image/
# compose service instead of maintaining separate dev/prod targets.

FROM node:22-alpine
RUN apk add --no-cache nginx

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
