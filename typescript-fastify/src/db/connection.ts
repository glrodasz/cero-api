import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import fastifyMongodb from 'fastify-mongodb'
import FastifyPlugin from 'fastify-plugin'

async function dbConnector(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  fastify
    .register(fastifyMongodb, {
      forceClose: true,
      url: process.env.MONGO_URL,
    })
    .after((error) => {
      if (error) {
        fastify.log.error('error connecting to mongo')
      }
      fastify.log.info('Connected to MongoDB 🎉')
    })
}

export = FastifyPlugin(dbConnector, {
  name: 'dbConnector',
})
