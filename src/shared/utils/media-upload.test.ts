import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../../../tests/msw-server";

const keystore = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
    getItemAsync: (key: string) => Promise.resolve(keystore.get(key) ?? null),
    setItemAsync: (key: string, value: string) => {
        keystore.set(key, value);
        return Promise.resolve();
    },
    deleteItemAsync: (key: string) => {
        keystore.delete(key);
        return Promise.resolve();
    },
}));

import { BASE_URL } from "@core/api/client";
import { clearTokens, setTokens } from "@core/session/tokens";
import { MODERATION_RETRY_DELAY_MS } from "./media-errors";
import { uploadMedia } from "./media-upload";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-10T00:00:00.000Z" },
    });

const problem = (title: string, status: number) =>
    HttpResponse.json(
        { type: "about:blank", title, status, detail: title, instance: "/" },
        { status },
    );

const asset = { uri: "file:///a/shot.png", fileName: "shot.png" };

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("uploadMedia", () => {
    it("sends nothing when nothing was picked", async () => {
        // No handler is registered, and MSW errors on an unhandled request —
        // so this passing is the assertion that no call was made.
        await expect(uploadMedia([])).resolves.toEqual([]);
    });

    it("lets the runtime write the multipart boundary", async () => {
        let contentType: string | null = null;

        server.use(
            http.post(`${BASE}/media`, ({ request }) => {
                contentType = request.headers.get("Content-Type");
                return ok({ mediaUrls: ["u1"] });
            }),
        );

        await expect(uploadMedia([asset])).resolves.toEqual(["u1"]);

        // `contentType: false` on the client. Setting the header ourselves
        // would write `multipart/form-data` with no boundary, and the server
        // would fail to parse a body it was handed correctly.
        expect(contentType).toContain("multipart/form-data");
        expect(contentType).toContain("boundary=");
    });

    it("absorbs one unreachable moderation provider", async () => {
        vi.useFakeTimers();
        let calls = 0;

        server.use(
            http.post(`${BASE}/media`, () => {
                calls += 1;
                return calls === 1
                    ? problem("ModerationUnavailableError", 503)
                    : ok({ mediaUrls: ["u1"] });
            }),
        );

        const pending = uploadMedia([asset]);
        await vi.advanceTimersByTimeAsync(MODERATION_RETRY_DELAY_MS);

        await expect(pending).resolves.toEqual(["u1"]);
        expect(calls).toBe(2);
    });

    it("gives up after the second unreachable answer", async () => {
        // One retry, not a loop: a provider blinking is worth absorbing, an
        // outage is not something to hide behind a spinner that never ends.
        vi.useFakeTimers();
        let calls = 0;

        server.use(
            http.post(`${BASE}/media`, () => {
                calls += 1;
                return problem("ModerationUnavailableError", 503);
            }),
        );

        // The assertion is attached before the timers run: a rejection with
        // no handler yet is reported as an unhandled one even though the test
        // is about to catch it.
        const settled = expect(uploadMedia([asset])).rejects.toMatchObject({
            title: "ModerationUnavailableError",
        });
        await vi.advanceTimersByTimeAsync(MODERATION_RETRY_DELAY_MS);
        await settled;

        expect(calls).toBe(2);
    });

    it("does not retry a verdict", async () => {
        // A rejection is an answer. Asking again would get the same one.
        let calls = 0;

        server.use(
            http.post(`${BASE}/media`, () => {
                calls += 1;
                return problem("MediaRejectedError", 422);
            }),
        );

        await expect(uploadMedia([asset])).rejects.toMatchObject({
            title: "MediaRejectedError",
        });
        expect(calls).toBe(1);
    });
});
