import { setupServer } from "msw/node";

/**
 * No default handlers. Every spec declares the requests it expects with
 * `server.use()`, which — together with `onUnhandledRequest: "error"` — means a
 * request nobody wrote a handler for names itself instead of escaping.
 */
export const server = setupServer();
