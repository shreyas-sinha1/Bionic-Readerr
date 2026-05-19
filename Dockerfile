FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_STANDALONE=true
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto fonts-noto-cjk ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
