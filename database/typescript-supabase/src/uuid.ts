const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are uuid columns, and Postgres refuses to compare a uuid with anything
 * else: PostgREST answers 400 (22P02). A malformed id cannot match a row
 * anyway, so the repositories drop it before it reaches the database.
 */
export const isUuid = (id: string): boolean => UUID_PATTERN.test(id);
