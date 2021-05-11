import fastify from "fastify";
import fastifyCors from "fastify-cors";
import dbConnector from "./db/connection";
import dotenv from "dotenv";

dotenv.config();

const server = fastify({ logger: { prettyPrint: true } });

server.register(fastifyCors, {
  origin: "*",
});

//server.register(dbConnector);

server.get("/", async (request, reply) => {
  return "Hello World!";
});

server.listen(process.env.PORT || 3000, "0.0.0.0", (err, address) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});

export default server;
