import { GrpcStatus } from "firebase-admin/firestore";

const MAX_ID_BYTES = 1_500;

/**
 * Whether `id` can name a Firestore document. Anything else (empty, a path
 * with "/", "." or "..", a reserved `__name__`, or too long) makes the SDK or
 * the server throw, while the storage port wants a malformed id to be simply
 * "not found".
 * See https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields
 */
export const isDocumentId = (id: string): boolean =>
  id !== "" &&
  id !== "." &&
  id !== ".." &&
  !id.includes("/") &&
  !/^__.*__$/.test(id) &&
  Buffer.byteLength(id) <= MAX_ID_BYTES;

/** `update()` refuses documents that do not exist with this error. */
export const isNotFound = (error: unknown): boolean => (error as { code?: unknown }).code === GrpcStatus.NOT_FOUND;
