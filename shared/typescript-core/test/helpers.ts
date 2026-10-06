import { createServices } from "../src/index.ts";
import { createInMemoryRepositories } from "../src/inMemory/index.ts";

/** Services wired to in-memory storage and a clock the test moves by hand. */
export const setup = () => {
  const repositories = createInMemoryRepositories();
  const clock = { now: 1_000_000 };
  const services = createServices(repositories, { clock: () => clock.now });

  return {
    ...services,
    repositories,
    advanceClock: (milliseconds: number) => {
      clock.now += milliseconds;
    },
    get now() {
      return clock.now;
    },
  };
};
