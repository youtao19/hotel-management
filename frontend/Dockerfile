FROM node:22.18.0 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-progress --prefer-offline || npm i

FROM node:22.18.0 AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 9000
CMD ["npm", "run", "dev"]


