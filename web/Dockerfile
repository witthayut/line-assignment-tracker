# Build the Vue app, then serve it with Caddy (automatic HTTPS + proxy to the API)
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
# Lockfiles made on Windows can miss Linux-only optional packages, so resolve fresh here
RUN rm -f package-lock.json && npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
