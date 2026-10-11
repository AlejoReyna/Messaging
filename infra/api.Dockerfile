FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
COPY infra/profile infra/profile
COPY scripts/bootstrap.mjs scripts/bootstrap.mjs
COPY scripts/database-env.mjs scripts/database-env.mjs
RUN npm run build:contracts && npm run build:api

FROM build AS tools
RUN groupadd -g 10001 chat && useradd -u 10001 -g chat -M chat
USER 10001:10001
CMD ["node", "scripts/bootstrap.mjs"]

FROM build AS pruned
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -g 10001 chat && useradd -u 10001 -g chat -M chat
COPY --from=pruned /app/node_modules ./node_modules
COPY --from=pruned /app/package.json ./package.json
COPY --from=pruned /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=pruned /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=pruned /app/apps/api ./apps/api
USER 10001:10001
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
