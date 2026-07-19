# Requires pnpm-lock.yaml to be committed (run `pnpm install` locally first).
FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@10

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/client/dist ./client/dist

# Persist blog content by mounting a volume at /app/data
EXPOSE 4000
CMD ["node", "dist-server/index.js"]
