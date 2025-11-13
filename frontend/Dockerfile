FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
RUN npm run postinstall || true
COPY . .

FROM node:22-bookworm-slim AS runner
WORKDIR /app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package*.json /app/
COPY . .

ENV NODE_ENV=dev
ENV VITE_API_BASE=http://localhost:3000

EXPOSE 3000
