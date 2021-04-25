FROM hayd/alpine-deno:1.9.0

EXPOSE 8080

WORKDIR /app

USER deno

COPY deps.ts .
RUN deno cache deps.ts

ADD . .
RUN deno cache src/index.ts

CMD ["run", "--allow-net", "src/index.ts"]