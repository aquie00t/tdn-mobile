import { describe, expect, it, vi } from "vitest";

import {
    clearsSelection,
    isMediaError,
    MEDIA_ERROR_TITLES,
    withModerationRetry,
} from "./media-errors";

const problem = (title: string, status = 400) => ({
    type: "about:blank",
    title,
    status,
    detail: "",
    instance: "/",
});

describe("clearsSelection", () => {
    it("discards the files on a verdict", () => {
        // A verdict clears all of them, not the offending one: /media takes
        // four files, processes them in order, and returns no URLs at all once
        // one is rejected — without saying which.
        expect(clearsSelection(problem(MEDIA_ERROR_TITLES.rejected, 422))).toBe(
            true,
        );
        expect(
            clearsSelection(problem(MEDIA_ERROR_TITLES.invalidMediaType, 415)),
        ).toBe(true);
        expect(
            clearsSelection(problem(MEDIA_ERROR_TITLES.invalidFileType, 415)),
        ).toBe(true);
        expect(clearsSelection(problem(MEDIA_ERROR_TITLES.tooLarge, 413))).toBe(
            true,
        );
    });

    it("keeps them when moderation never reached a verdict", () => {
        // The same files are still fine; dropping them would be the client
        // inventing a rejection the server did not make.
        expect(
            clearsSelection(problem(MEDIA_ERROR_TITLES.unavailable, 503)),
        ).toBe(false);
    });

    it("keeps them for an answer about the request rather than the files", () => {
        // "You picked five" is fixed by putting one back. Taking all five away
        // to say so is the least useful reading of it.
        expect(clearsSelection(problem(MEDIA_ERROR_TITLES.limitExceeded))).toBe(
            false,
        );
        expect(clearsSelection(problem(MEDIA_ERROR_TITLES.noneProvided))).toBe(
            false,
        );
    });

    it("keeps them for anything that is not a media error at all", () => {
        // The default is to keep. The other way round would take somebody's
        // four selected files away over a 500 from the create call that
        // follows the upload, or over a dropped connection — neither of which
        // says anything about the files.
        expect(clearsSelection(problem("InternalServerError", 500))).toBe(
            false,
        );
        expect(clearsSelection(new Error("network"))).toBe(false);
        expect(clearsSelection(null)).toBe(false);
        expect(clearsSelection(undefined)).toBe(false);
    });
});

describe("isMediaError", () => {
    it("matches on the title and nothing else", () => {
        expect(
            isMediaError(
                problem(MEDIA_ERROR_TITLES.notOwned),
                MEDIA_ERROR_TITLES.notOwned,
            ),
        ).toBe(true);
        expect(
            isMediaError(
                problem(MEDIA_ERROR_TITLES.notOwned),
                MEDIA_ERROR_TITLES.rejected,
            ),
        ).toBe(false);
        expect(isMediaError({ title: 42 }, MEDIA_ERROR_TITLES.rejected)).toBe(
            false,
        );
        expect(isMediaError("nope", MEDIA_ERROR_TITLES.rejected)).toBe(false);
    });
});

describe("withModerationRetry", () => {
    it("absorbs one unreachable-provider failure", async () => {
        const upload = vi
            .fn()
            .mockRejectedValueOnce(problem(MEDIA_ERROR_TITLES.unavailable, 503))
            .mockResolvedValueOnce({ mediaUrls: ["a.jpg"] });

        await expect(withModerationRetry(upload, 0)).resolves.toEqual({
            mediaUrls: ["a.jpg"],
        });
        expect(upload).toHaveBeenCalledTimes(2);
    });

    it("retries once, not in a loop", async () => {
        // A provider blinking is worth absorbing silently. An outage is not
        // worth hiding behind a spinner that never ends.
        const err = problem(MEDIA_ERROR_TITLES.unavailable, 503);
        const upload = vi.fn().mockRejectedValue(err);

        await expect(withModerationRetry(upload, 0)).rejects.toBe(err);
        expect(upload).toHaveBeenCalledTimes(2);
    });

    it("does not retry a verdict", async () => {
        // The file will be refused again, and the second attempt spends the
        // upload rate limit to learn nothing.
        const err = problem(MEDIA_ERROR_TITLES.rejected, 422);
        const upload = vi.fn().mockRejectedValue(err);

        await expect(withModerationRetry(upload, 0)).rejects.toBe(err);
        expect(upload).toHaveBeenCalledTimes(1);
    });
});
