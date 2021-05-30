import fp from 'fastify-plugin'

module.exports = fp(async (fastify, opts) => {
  fastify.decorate("timestamp", function () {
    return Date.now();
  });
});
