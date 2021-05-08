from node:14.14-alpine as builder

WORKDIR /src/app

COPY package.json /src/app
COPY yarn.lock /src/app

RUN yarn install

COPY --from=builder /src/app /src/app
EXPOSE 8080

ENTRYPOINT ["yarn", "start"]