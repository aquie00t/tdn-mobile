import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw-server";

/*
 * An unhandled request is a bug, not a fallback.
 *
 * `"warn"` lets it through to the real network, which passes locally and on
 * most CI runs and then fails as a timeout with nothing in it pointing at the
 * cause. `"error"` blocks the request and names it, and it holds for tests
 * nobody has written yet: one that forgets a handler fails immediately rather
 * than quietly depending on production being up and fast.
 */
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
