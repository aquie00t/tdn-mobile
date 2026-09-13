import { afterEach, describe, expect, it, vi } from "vitest";

const asyncStore = vi.hoisted(() => new Map<string, string>());

// `translate` reads the language store, which persists through AsyncStorage.
vi.mock("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: (key: string) => Promise.resolve(asyncStore.get(key) ?? null),
        setItem: (key: string, value: string) => {
            asyncStore.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            asyncStore.delete(key);
            return Promise.resolve();
        },
    },
}));

vi.mock("expo-localization", () => ({
    getLocales: () => [{ languageCode: "en" }],
}));

import { NetworkError } from "../../core/api/api.types";
import type { ApiErrorResponse } from "../../core/api/api.types";
import { getErrorMessage, isOurFailure } from "./error-handler";
import { isDevBuild, readerFacingMessage, reportError } from "./report-error";
import { translations } from "../i18n/translations";

const en = translations.en;

function problem(over: Partial<ApiErrorResponse>): ApiErrorResponse {
    return {
        type: "about:blank",
        title: "Error",
        status: 500,
        detail: "",
        instance: "/",
        ...over,
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("reportError", () => {
    it("tells the developer, with the error attached, in a dev build", () => {
        vi.stubGlobal("__DEV__", true);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const error = new Error("offline");

        reportError("post.like", error);

        expect(warn).toHaveBeenCalledWith("[post.like]", error);
    });

    it("says nothing at all in a release build", () => {
        vi.stubGlobal("__DEV__", false);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        reportError("post.like", new Error("offline"));

        expect(warn).not.toHaveBeenCalled();
    });
});

describe("isDevBuild", () => {
    it("is false where Metro never defined __DEV__", () => {
        // Vitest is exactly that place: a bare read would throw here.
        expect(isDevBuild()).toBe(false);
    });

    it("follows __DEV__ where it exists", () => {
        vi.stubGlobal("__DEV__", true);
        expect(isDevBuild()).toBe(true);
    });
});

describe("isOurFailure", () => {
    it("recognises the failures that are ours", () => {
        expect(isOurFailure(getErrorMessage(new NetworkError("offline")))).toBe(
            true,
        );
        expect(
            isOurFailure(
                getErrorMessage(new NetworkError("Request timed out")),
            ),
        ).toBe(true);
        expect(
            isOurFailure(
                getErrorMessage(
                    problem({ detail: "An unexpected error occurred." }),
                ),
            ),
        ).toBe(true);
        expect(isOurFailure(getErrorMessage("thrown string"))).toBe(true);
    });

    it("leaves the server's answers to the reader", () => {
        // A deleted post, a rate limit and a refused file are all things the
        // reader has to know — a retry cannot fix any of them.
        expect(
            isOurFailure(
                getErrorMessage(
                    problem({
                        status: 404,
                        title: "NotFoundError",
                        detail: "Post not found.",
                    }),
                ),
            ),
        ).toBe(false);
        expect(
            isOurFailure(
                getErrorMessage(
                    problem({ status: 429, title: "TooManyRequestsError" }),
                ),
            ),
        ).toBe(false);
        expect(
            isOurFailure(
                getErrorMessage(
                    problem({ status: 422, title: "MediaRejectedError" }),
                ),
            ),
        ).toBe(false);
    });
});

describe("readerFacingMessage", () => {
    it("says only that it did not load when the failure is ours", () => {
        expect(readerFacingMessage(en["error.network"])).toBe(
            en["common.loadFailed"],
        );
    });

    it("passes the server's answer through", () => {
        expect(readerFacingMessage("Post not found.")).toBe("Post not found.");
    });

    it("shows the developer everything in a dev build", () => {
        vi.stubGlobal("__DEV__", true);
        expect(readerFacingMessage(en["error.network"])).toBe(
            en["error.network"],
        );
    });
});
