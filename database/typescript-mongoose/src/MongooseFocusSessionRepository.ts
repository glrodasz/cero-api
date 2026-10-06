import {
  CURRENT_SESSION_STATUSES,
  type FocusSession,
  type FocusSessionRepository,
  type NewFocusSession,
} from "@cero/core";
import { isObjectIdOrHexString, type Connection, type Model } from "mongoose";
import { focusSessionSchema, type FocusSessionDocument } from "./schemas.ts";

const toFocusSession = (document: FocusSessionDocument): FocusSession => ({
  id: document._id.toHexString(),
  status: document.status,
  startTime: document.startTime,
  tasks: [...document.tasks],
  pauses: document.pauses.map(({ id, startTime, endTime, time }) => ({ id, startTime, endTime, time })),
});

export class MongooseFocusSessionRepository implements FocusSessionRepository {
  #model: Model<FocusSessionDocument>;

  constructor(connection: Connection) {
    this.#model = connection.models.FocusSession ?? connection.model<FocusSessionDocument>("FocusSession", focusSessionSchema);
  }

  async findAll(): Promise<FocusSession[]> {
    const documents = await this.#model.find().sort({ _id: 1 }).lean<FocusSessionDocument[]>().exec();
    return documents.map(toFocusSession);
  }

  async findById(id: string): Promise<FocusSession | null> {
    if (!isObjectIdOrHexString(id)) {
      return null;
    }

    const document = await this.#model.findById(id).lean<FocusSessionDocument>().exec();
    return document ? toFocusSession(document) : null;
  }

  async findCurrent(): Promise<FocusSession | null> {
    const document = await this.#model
      .findOne({ status: { $in: CURRENT_SESSION_STATUSES } })
      .sort({ _id: -1 })
      .lean<FocusSessionDocument>()
      .exec();
    return document ? toFocusSession(document) : null;
  }

  async create(session: NewFocusSession): Promise<FocusSession> {
    const document = await this.#model.create(session);
    return toFocusSession(document.toObject());
  }

  async save({ id, ...fields }: FocusSession): Promise<void> {
    if (isObjectIdOrHexString(id)) {
      await this.#model.updateOne({ _id: id }, { $set: fields }).exec();
    }
  }
}
