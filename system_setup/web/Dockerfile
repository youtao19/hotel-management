FROM node:18.16.0 AS builder

WORKDIR /app

# 仅复制 lock 与 package 清单，加速构建缓存
COPY package.json package-lock.json ./

RUN npm ci --no-progress --prefer-offline

FROM node:18.16.0 As runner

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 CMD curl -fsS http://localhost:3000/api/hup || exit 1

CMD ["node", "server.js"]