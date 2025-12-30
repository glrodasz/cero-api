const config = {
  port: Number(process.env.PORT) || 3000,
  mongodbUri:
    process.env.MONGODB_URI ??
    "mongodb://root:root@127.0.0.1:27017/cero?authSource=admin",
} as const;

export default config;

