import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../../../../tests/msw-server";

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
import { settingsApi } from "./settings.api";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-13T00:00:00.000Z" },
    });

const noContent = () => new HttpResponse(null, { status: 204 });

const problem = (status: number, detail: string) =>
    HttpResponse.json(
        {
            type: "about:blank",
            title: status === 409 ? "ConflictError" : "BadRequestError",
            status,
            detail,
            instance: "/api/v1/users/me",
        },
        { status },
    );

/** What the request carried, for the assertions that care. */
interface Captured {
    body: unknown;
    contentType: string | null;
}

async function capture(request: Request): Promise<Captured> {
    const text = await request.text();
    return {
        body: text ? (JSON.parse(text) as unknown) : null,
        contentType: request.headers.get("Content-Type"),
    };
}

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
});

describe("getAccountInfo", () => {
    it("reads the account and unwraps it", async () => {
        const account = {
            id: "u1",
            username: "ada",
            email: "ada@example.com",
            isEmailVerified: true,
            providers: ["GITHUB"],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        };
        server.use(http.get(`${BASE}/users/me`, () => ok(account)));

        await expect(settingsApi.getAccountInfo()).resolves.toEqual(account);
    });
});

describe("the three changes", () => {
    it("sends a new username under the name the schema expects", async () => {
        let seen: Captured | null = null;
        server.use(
            http.patch(`${BASE}/users/me/username`, async ({ request }) => {
                seen = await capture(request);
                return noContent();
            }),
        );

        await expect(settingsApi.updateUsername("ada")).resolves.toEqual({});
        expect(seen).toEqual({
            body: { newUsername: "ada" },
            contentType: "application/json",
        });
    });

    it("hands a taken username back as the API worded it", async () => {
        server.use(
            http.patch(`${BASE}/users/me/username`, () =>
                problem(409, "This username is already taken."),
            ),
        );

        await expect(settingsApi.updateUsername("taken")).rejects.toEqual(
            expect.objectContaining({
                status: 409,
                detail: "This username is already taken.",
            }),
        );
    });

    it("sends a new email under the name the schema expects", async () => {
        let seen: Captured | null = null;
        server.use(
            http.patch(`${BASE}/users/me/email`, async ({ request }) => {
                seen = await capture(request);
                return noContent();
            }),
        );

        await settingsApi.updateEmail("ada@example.com");
        expect(seen).toEqual({
            body: { newEmail: "ada@example.com" },
            contentType: "application/json",
        });
    });

    it("sends both passwords", async () => {
        let seen: Captured | null = null;
        server.use(
            http.patch(`${BASE}/users/me/password`, async ({ request }) => {
                seen = await capture(request);
                return noContent();
            }),
        );

        await settingsApi.updatePassword({
            currentPassword: "old-password",
            newPassword: "new-password",
        });
        expect(seen).toEqual({
            body: {
                currentPassword: "old-password",
                newPassword: "new-password",
            },
            contentType: "application/json",
        });
    });
});

describe("deleteAccount", () => {
    it("carries the password in the body of the DELETE", async () => {
        // Without a body the schema refuses the request before the password
        // is ever checked — the web shipped exactly that once.
        let seen: Captured | null = null;
        server.use(
            http.delete(`${BASE}/users/me`, async ({ request }) => {
                seen = await capture(request);
                return noContent();
            }),
        );

        await expect(settingsApi.deleteAccount("hunter22")).resolves.toEqual(
            {},
        );
        expect(seen).toEqual({
            body: { password: "hunter22" },
            contentType: "application/json",
        });
    });

    it("reports a wrong password without touching the session", async () => {
        // A 400, not a 401: nothing is refreshed, nothing is replayed, and the
        // person stays signed in to try again.
        let refreshed = false;
        server.use(
            http.delete(`${BASE}/users/me`, () =>
                problem(400, "Invalid password."),
            ),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshed = true;
                return HttpResponse.json({}, { status: 500 });
            }),
        );

        await expect(settingsApi.deleteAccount("wrong")).rejects.toEqual(
            expect.objectContaining({
                status: 400,
                detail: "Invalid password.",
            }),
        );
        expect(refreshed).toBe(false);
    });
});
