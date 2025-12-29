# Typescript Fastify example

This example mirrors the structure used in the `typescript-express` project but swaps the framework for Fastify 5.6. It exposes task and focus session endpoints backed by MongoDB and uses the same mongoose models as the Express sample.

## Getting started

1. Copy environment variables:

```bash
cd typescript-fastify
cp .env.example .env
```

2. Install dependencies:

```bash
yarn install
```

3. Run the API in development mode:

```bash
yarn dev
```

The server will start on `http://localhost:3000` by default and connect to MongoDB using the `MONGODB_URI` value in your `.env` file.
