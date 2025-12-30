FROM node:22-alpine AS base

WORKDIR /app

COPY package.json ./

RUN yarn install --frozen-lockfile || yarn install

COPY . .

RUN yarn build

EXPOSE 3000

CMD ["node", "dist/index.js"]
