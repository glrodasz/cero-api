import fastify from 'fastify'
import fastifyCors from 'fastify-cors'
import swagger from 'fastify-swagger'
import dotenv from 'dotenv'

import dbConnector from './db/connection'
import tasksRoutes from './routes/tasks'
import options from './utils/swagger'

dotenv.config()

const server = fastify({ logger: { prettyPrint: true } })

server.register(dbConnector)
server.register(fastifyCors, {
  origin: '*',
})

server.register(swagger, options)

tasksRoutes.forEach((route) => {
  server.route(route)
})

server.listen(process.env.PORT || 3000, '0.0.0.0', (err, address) => {
  if (err) {
    console.log(err)
    process.exit(1)
  }
})

export default server
