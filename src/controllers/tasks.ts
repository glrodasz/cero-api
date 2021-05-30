import server from "../index";
import { FastifyRequest, FastifyReply } from "fastify";
import { CreateTaskBodySchema } from "../@types/createTaskBodySchema";
import { UpdateTaskBodySchema } from "../@types/updateTaskBodySchema";
import { UpdateTaskParamsSchema } from "../@types/updateTaskParamsSchema";
import { DeleteTaskParamsSchema } from "../@types/deleteTaskParamsSchema";
import { ObjectId } from "bson";
import { Db } from "mongodb";

export const createTask = async (
  request: FastifyRequest<{ Body: CreateTaskBodySchema }>,
  reply: FastifyReply
) => {
  try {
    const db = server.mongo.db as Db;
    // TODO: define if use json-schema-to-ts
    const { title, description, priority } = request.body;
    const data = {
      title,
      description,
      priority,
    };
    const createdTask = await db.collection("tasksUsers").insertOne(data);
    return { id: createdTask.insertedId };
  } catch (error) {
    server.log.error("error inserting data");
    server.log.error(error);
  }
};

export const getTasks = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const db = server.mongo.db as Db;
    const tasks = await db.collection("tasksUsers").find().toArray();
    return tasks;
  } catch (error) {
    server.log.error("error reading data");
    server.log.error(error);
  }
};

export const updateTask = async (
  request: FastifyRequest<{
    Body: UpdateTaskBodySchema;
    Params: UpdateTaskParamsSchema;
  }>,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params;
    const { description, priority } = request.body;
    const data = {
      description,
      priority,
    };
    const db = server.mongo.db as Db;
    const updatedTask = await db
      .collection("tasksUsers")
      .updateOne({ _id: new ObjectId(id) }, { $set: data });
    return { updatedElements: updatedTask.modifiedCount };
  } catch (error) {
    server.log.error("error updating data");
    server.log.error(error);
  }
};

export const deleteTask = async (
  request: FastifyRequest<{
    Params: DeleteTaskParamsSchema;
  }>,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params;
    const db = server.mongo.db as Db;
    const deletedTask = await db
      .collection("tasksUsers")
      .deleteOne({ _id: new ObjectId(id) });
    return { deletedElements: deletedTask.deletedCount };
  } catch (error) {
    server.log.error("error deleting data");
    server.log.error(error);
  }
};
