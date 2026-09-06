import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStore = vi.hoisted(() => new Map<string, string>());

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
import { getErrorMessage } from "./error-handler";
import { translations } from "../i18n/translations";
import { useLanguageStore } from "../store/language.store";
import type { ApiErrorResponse } from "../../core/api/api.types";

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

const en = translations.en;

beforeEach(() => {
    asyncStore.clear();
    useLanguageStore.setState({ locale: "en" });
});

describe("connection failures", () => {
    it("tells a timeout apart from an unreachable network", () => {
        expect(getErrorMessage(new NetworkError("Request timed out"))).toBe(
            en["error.timeout"],
        );
        expect(getErrorMessage(new NetworkError())).toBe(en["error.network"]);
    });
});

describe("what the server said", () => {
    it("shows a specific 4xx detail verbatim", () => {
        // The API writes messages the client cannot infer from a status. A 401
        // from /auth/login means "wrong password", not "your session ended".
        expect(
            getErrorMessage(
                problem({
                    status: 401,
                    title: "UnauthorizedError",
                    detail: "Invalid credentials.",
                }),
            ),
        ).toBe("Invalid credentials.");
    });

    it("replaces a generic 5xx, which carries nothing to lose", () => {
        expect(
            getErrorMessage(
                problem({
                    status: 500,
                    detail: "An unexpected error occurred.",
                }),
            ),
        ).toBe(en["error.server"]);

        expect(getErrorMessage(problem({ status: 502, detail: "" }))).toBe(
            en["error.server"],
        );
    });

    it("treats a document the client synthesised as ours to reword", () => {
        expect(
            getErrorMessage(
                problem({
                    type: "tdn:unreadable-response",
                    status: 502,
                    detail: "The server answered 502 with a body that is not JSON.",
                }),
            ),
        ).toBe(en["error.server"]);
    });

    it("prefers a validation message over everything else", () => {
        expect(
            getErrorMessage(
                problem({
                    status: 400,
                    detail: "Invalid data format provided.",
                    validation: [
                        {
                            instancePath: "/content",
                            schemaPath: "#/properties/content/minLength",
                            keyword: "minLength",
                            params: {},
                            message: "must NOT have fewer than 1 characters",
                        },
                    ],
                }),
            ),
        ).toBe("must NOT have fewer than 1 characters");
    });
});

describe("the two sentences answered in our own words", () => {
    it("answers a rate limit, which an ordinary exchange reaches", () => {
        expect(
            getErrorMessage(
                problem({
                    status: 429,
                    title: "TooManyRequestsError",
                    detail: "Too many requests.",
                }),
            ),
        ).toBe(en["error.rateLimited"]);
    });

    it("answers a media verdict by title, not by status", () => {
        expect(
            getErrorMessage(
                problem({
                    status: 422,
                    title: "MediaRejectedError",
                    detail: "Rejected.",
                }),
            ),
        ).toBe(en["error.mediaRejected"]);
    });

    it("keeps the 503 distinct from a generic server failure", () => {
        // This is the ordering that matters. ModerationUnavailableError is a
        // 503, so the generic-5xx branch would answer it with "something went
        // wrong" — losing the one thing worth knowing, which is that trying
        // again in a moment will work.
        const message = getErrorMessage(
            problem({
                status: 503,
                title: "ModerationUnavailableError",
                detail: "The server could not complete the request.",
            }),
        );

        expect(message).toBe(en["error.moderationUnavailable"]);
        expect(message).not.toBe(en["error.server"]);
    });

    it("tells the two 415s apart", () => {
        // InvalidMediaTypeError and InvalidFileTypeError share a status and
        // mean different things, which is why the branch is on title.
        expect(
            getErrorMessage(
                problem({ status: 415, title: "InvalidMediaTypeError" }),
            ),
        ).toBe(en["error.invalidMediaType"]);
        expect(
            getErrorMessage(
                problem({ status: 415, title: "InvalidFileTypeError" }),
            ),
        ).toBe(en["error.invalidFileType"]);
    });
});

describe("anything else", () => {
    it("answers a thrown value that is not a problem document", () => {
        expect(getErrorMessage(new Error("boom"))).toBe(en["error.unexpected"]);
        expect(getErrorMessage(null)).toBe(en["error.unexpected"]);
        expect(getErrorMessage("a string")).toBe(en["error.unexpected"]);
    });
});

describe("it speaks the reader's language", () => {
    it("answers in Turkish once the locale is Turkish", () => {
        useLanguageStore.setState({ locale: "tr" });
        expect(getErrorMessage(new NetworkError())).toBe(
            translations.tr["error.network"],
        );
    });
});
