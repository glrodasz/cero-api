const schemas = require("./../schemas/todo");

module.exports = async function (fastify, opts) {
  fastify.get(
    "/",
    { schema: schemas.findAll },
    async function (request, reply) {
      return this.mongo.db.collection("todo").find().toArray();
    }
  );

  fastify.post(
    "/",
    { schema: schemas.insertOne },
    async function (request, reply) {
      return this.mongo.db.collection("todo").insertOne(
        Object.assign(request.body, {
          timestamp: this.timestamp(),
          done: false,
        })
      );
    }
  );

  fastify.delete(
    "/:name",
    { schema: schemas.deleteOne },
    async function (request, reply) {
      return this.mongo.db
        .collection("todo")
        .deleteOne({ name: request.params.name });
    }
  );
};
