import fastify from 'fastify'
import fastifyCors from 'fastify-cors'
import swagger from 'fastify-swagger'
import os from 'os'

import dbConnector from './db/connection'
import tasksRoutes from './routes/tasks'
import options from './utils/swagger'

const { PORT: port } = process.env
const server = fastify({ logger: { prettyPrint: true } })

server.register(dbConnector)
server.register(fastifyCors, {
  origin: '*',
})

server.register(swagger, options)

tasksRoutes.forEach((route) => {
  server.route(route)
})

server.get('/', async (request, reply) => {
  reply.send({ message: 'Reto API running', instance: os.hostname() })
})

server.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.log(err)
    process.exit(1)
  }
})

export default server
