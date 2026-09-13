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
import { verificationApi } from "./verification.api";

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

describe("sendVerification", () => {
    it("asks for a code for the signed-in account", async () => {
        let auth: string | null = null;
        server.use(
            http.post(`${BASE_URL}/auth/send-verification`, ({ request }) => {
                auth = request.headers.get("Authorization");
                return ok({ sent: true });
            }),
        );

        await expect(verificationApi.sendVerification()).resolves.toEqual({
            sent: true,
        });
        expect(auth).toBe("Bearer fresh");
    });
});

describe("verifyEmail", () => {
    it("sends the code as `otp`", async () => {
        let body: unknown = null;
        server.use(
            http.post(`${BASE_URL}/auth/verify-email`, async ({ request }) => {
                body = await request.json();
                return ok({ verified: true });
            }),
        );

        await expect(verificationApi.verifyEmail("12345678")).resolves.toEqual({
            verified: true,
        });
        expect(body).toEqual({ otp: "12345678" });
    });

    it("hands a wrong code back to the caller as the API worded it", async () => {
        server.use(
            http.post(`${BASE_URL}/auth/verify-email`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "BadRequestError",
                        status: 400,
                        detail: "Invalid or expired code.",
                        instance: "/api/v1/auth/verify-email",
                    },
                    { status: 400 },
                ),
            ),
        );

        await expect(verificationApi.verifyEmail("00000000")).rejects.toEqual(
            expect.objectContaining({
                status: 400,
                detail: "Invalid or expired code.",
            }),
        );
    });
});
