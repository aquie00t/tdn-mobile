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
import { REPORT_DETAILS_MAX_LENGTH } from "./report.types";
import { reportApi, reportBody } from "./report.api";

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-13T00:00:00.000Z" },
    });

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
});

describe("reportBody", () => {
    it("names the target, its kind and the reason", () => {
        expect(reportBody("POST", "post-1", "SPAM", "")).toEqual({
            targetKind: "POST",
            targetId: "post-1",
            reason: "SPAM",
        });
    });

    it("leaves the free text out rather than sending it empty", () => {
        // `""` fails the schema's 1–500 check; absent is "no comment".
        expect(
            reportBody("COMMENT", "c-1", "HATE", "   \n "),
        ).not.toHaveProperty("details");
    });

    it("trims the free text it does send", () => {
        expect(
            reportBody("POST", "post-1", "OTHER", "  a phishing link  ")
                .details,
        ).toBe("a phishing link");
    });

    it("never sends more than the schema takes", () => {
        const long = "x".repeat(REPORT_DETAILS_MAX_LENGTH + 20);
        expect(
            reportBody("POST", "post-1", "OTHER", long).details,
        ).toHaveLength(REPORT_DETAILS_MAX_LENGTH);
    });
});

describe("reportApi.create", () => {
    it("posts the body and unwraps the acknowledgement", async () => {
        let body: unknown = null;
        server.use(
            http.post(`${BASE_URL}/reports`, async ({ request }) => {
                body = await request.json();
                return ok({ received: true });
            }),
        );

        await expect(
            reportApi.create(reportBody("POST", "post-1", "SPAM", "scam")),
        ).resolves.toEqual({ received: true });
        expect(body).toEqual({
            targetKind: "POST",
            targetId: "post-1",
            reason: "SPAM",
            details: "scam",
        });
    });

    it("cannot tell a repeat report from a first one", async () => {
        // The endpoint answers both the same way on purpose, so there is no
        // "already reported" for the client to remember.
        server.use(
            http.post(`${BASE_URL}/reports`, () => ok({ received: true })),
        );

        const first = await reportApi.create(
            reportBody("POST", "post-1", "SPAM", ""),
        );
        const second = await reportApi.create(
            reportBody("POST", "post-1", "SPAM", ""),
        );

        expect(second).toEqual(first);
    });

    it("hands a refusal back as the API worded it", async () => {
        server.use(
            http.post(`${BASE_URL}/reports`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "Bad Request",
                        status: 400,
                        detail: "You cannot report your own content.",
                        instance: "/api/v1/reports",
                    },
                    { status: 400 },
                ),
            ),
        );

        await expect(
            reportApi.create(reportBody("POST", "mine", "SPAM", "")),
        ).rejects.toEqual(
            expect.objectContaining({
                status: 400,
                detail: "You cannot report your own content.",
            }),
        );
    });
});
