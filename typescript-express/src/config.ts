const STORAGES = ["mongodb", "memory"] as const;

type Storage = (typeof STORAGES)[number];

const readStorage = (value: string = "mongodb"): Storage => {
  if (!STORAGES.includes(value as Storage)) {
    throw new Error(`STORAGE must be one of: ${STORAGES.join(", ")} (got "${value}")`);
  }
  return value as Storage;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  storage: readStorage(process.env.STORAGE),
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://root:root@127.0.0.1:27017/cero_typescript?authSource=admin",
};
