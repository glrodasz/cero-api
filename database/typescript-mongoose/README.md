# @cero/mongoose

MongoDB storage for [`@cero/core`](../../shared/typescript-core), built on
Mongoose. Used by every TypeScript implementation that talks to MongoDB.

- [`src/schemas.ts`](src/schemas.ts): the document shape (collections `tasks`
  and `focus_sessions`, pauses embedded). The Python MongoDB adapter uses the
  same shape.
- [`src/MongooseTaskRepository.ts`](src/MongooseTaskRepository.ts) and
  [`src/MongooseFocusSessionRepository.ts`](src/MongooseFocusSessionRepository.ts):
  the two ports. Reads use `lean()` and map documents to plain domain objects.
- `openMongoStorage(uri)` returns `{ repositories, close }` for an app's `main`.

## Test it

The tests run the core's repository contract against a real MongoDB:

```bash
docker compose up -d mongo
yarn workspace @cero/mongoose test
```
