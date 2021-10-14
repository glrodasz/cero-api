import fastify from "fastify";
import fastifyCors from "fastify-cors";
import dbConnector from "./db/connection";
import dotenv from "dotenv";
import tasksRoutes from "./routes/tasks";

dotenv.config();

const server = fastify({ logger: { prettyPrint: true } });

server.register(fastifyCors, {
  origin: "*",
});

server.register(dbConnector);

tasksRoutes.forEach((route) => {
  server.route(route);
});

server.listen(process.env.PORT || 3000, "0.0.0.0", (err, address) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
});

export default server;
