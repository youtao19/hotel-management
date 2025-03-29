FROM node:18.16.0 AS builder

WORKDIR /app

COPY package.json package-lock.json .puppeteerrc.cjs ./

RUN npm ci

FROM node:18.16.0 As runner

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/api/hup || exit 1

CMD ["node", "server.js"]