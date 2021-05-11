import server from "../index";
import { FastifyRequest, FastifyReply } from "fastify";
import { Db } from "mongodb";

export const createTask = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const db = server.mongo.db as Db;
    // TODO: define if use json-schema-to-ts
    const { title } = request.body;
    const data = {
      title,
    };
    const createdTask = await db.collection("tasksUser").insertOne(data);
    return { id: createdTask.insertedId };
  } catch (error) {
    server.log.error("error inserting data");
    server.log.error(error);
  }
};

export const readTasks = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const db = server.mongo.db as Db;
      const readTasks = await db.collection('tasksUser').find().toArray();
      return readTasks;
    } catch (error) {
      server.log.error('error reading data');
      server.log.error(error);
    }
  };