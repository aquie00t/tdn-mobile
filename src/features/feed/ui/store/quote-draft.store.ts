import { create } from "zustand";

import type { QuotedPost } from "../../data/feed.types";

interface QuoteDraftState {
    /** The post the composer is about to quote, if it was handed over. */
    quoted: QuotedPost | null;
    set: (quoted: QuotedPost) => void;
    clear: () => void;
}

/**
 * The post being quoted, handed from the card to the composer.
 *
 * The composer is a route, and a route takes strings. Passing only the id and
 * re-reading the post is correct and was the first attempt — it is also a
 * network round trip in front of somebody who has just pressed a button, so
 * the preview arrived after a blank pause. The card already holds the whole
 * post; leaving it here costs nothing and the preview is there on the first
 * frame.
 *
 * The composer still falls back to fetching when this is empty, which is what
 * a link opened from outside the app hits.
 */
export const useQuoteDraftStore = create<QuoteDraftState>((set) => ({
    quoted: null,
    set: (quoted) => set({ quoted }),
    clear: () => set({ quoted: null }),
}));
